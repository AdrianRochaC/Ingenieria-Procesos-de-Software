import os
import logging
from flask import Flask, request, render_template, session, redirect
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import base64
from io import BytesIO

from google.oauth2 import id_token
from google.auth.transport import requests as grequests

from sentiment import analizar_sentimiento
from text_utils import (
    normalizar_texto,
    es_solo_simbolos,
    es_texto_basura,
    tiene_palabras_validas,
    PALABRAS_GENERICAS
)

# ==========================================
# 1. BIENVENIDA Y CONFIGURACIÓN DE LOGS
# ==========================================
print("\n" + "="*50)
print("  BIENVENIDO AL SISTEMA DE ANÁLISIS DE SENTIMIENTOS")
print("  Iniciando servicios y verificando configuración...")
print("="*50 + "\n")

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# ==============================
# 2. CONFIGURACIÓN APP
# ==============================

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "super-secret-key")

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
ALLOWED_DOMAIN = "gmail.com" 

# Verificación de ID de Google
if not GOOGLE_CLIENT_ID:
    logger.error("¡ALERTA! GOOGLE_CLIENT_ID no detectado en variables de entorno.")
else:
    logger.info(f"Configuración cargada correctamente. ID: {GOOGLE_CLIENT_ID[:15]}...")

# ==============================
# 3. VALIDAR TOKEN GOOGLE
# ==============================

def verify_google_token(token):
    try:
        logger.debug("Verificando autenticidad del token con Google APIs...")
        
        idinfo = id_token.verify_oauth2_token(
            token,
            grequests.Request(),
            GOOGLE_CLIENT_ID
        )

        user_email = idinfo.get("email", "")
        user_domain = idinfo.get("hd")
        
        logger.debug(f"Datos recibidos de Google -> Email: {user_email} | Dominio(hd): {user_domain}")

        # Validación de dominio
        if ALLOWED_DOMAIN == "gmail.com":
            if not user_email.endswith("@gmail.com"):
                logger.warning(f"Acceso denegado: El correo {user_email} no es @gmail.com")
                return None
        elif user_domain != ALLOWED_DOMAIN:
            logger.warning(f"Acceso denegado: El dominio {user_domain} no es el autorizado.")
            return None

        return idinfo

    except ValueError as e:
        logger.error(f"El token es inválido o expiró: {e}")
        return None
    except Exception as e:
        logger.error(f"Error crítico validando token: {e}", exc_info=True)
        return None

# ==============================
# 4. RUTAS DE AUTENTICACIÓN
# ==============================

@app.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        token = data.get("credential")

        if not token:
            logger.warning("Intento de login sin credenciales.")
            return {"status": "no_token"}, 400

        user_info = verify_google_token(token)

        if user_info:
            session["user"] = {
                "name": user_info.get("name"),
                "email": user_info.get("email"),
                "picture": user_info.get("picture")
            }
            logger.info(f"SESIÓN INICIADA: {user_info.get('email')}")
            return {"status": "success"}
        
        return {"status": "unauthorized"}, 401
            
    except Exception as e:
        logger.error(f"Error en ruta /login: {e}")
        return {"status": "error"}, 500

@app.route("/logout")
def logout():
    logger.info(f"Cerrando sesión para: {session.get('user', {}).get('email')}")
    session.clear()
    return redirect("/")

# ==============================
# 5. RUTA PRINCIPAL Y LÓGICA
# ==============================

@app.route("/", methods=["GET", "POST"])
def analizar_estados():

    if request.method == "GET":
        return render_template(
            "index.html",
            client_id=GOOGLE_CLIENT_ID,
            user=session.get("user")
        )

    if "user" not in session:
        logger.warning("Acceso denegado: Usuario no autenticado intentó procesar archivo.")
        return redirect("/")

    try:
        archivo = request.files.get("file")
        if not archivo:
            return "No se subió ningún archivo", 400

        logger.info(f"Procesando archivo '{archivo.filename}' de: {session['user']['email']}")
        
        df = pd.read_excel(archivo)

        if df.shape[1] != 1:
            logger.error("Error: El archivo subido tiene más de una columna.")
            return "El archivo debe tener una sola columna", 400

        # Limpieza de datos
        serie = df.iloc[:, 0].dropna().astype(str)
        total_inicial = len(serie)
        
        serie = serie.apply(normalizar_texto)
        serie = serie[~serie.isin(PALABRAS_GENERICAS)]
        serie = serie[~serie.apply(es_solo_simbolos)]
        serie = serie[~serie.apply(es_texto_basura)]
        serie = serie[serie.apply(tiene_palabras_validas)]

        logger.debug(f"Filas procesadas: de {total_inicial} bajó a {len(serie)} tras limpieza.")

        if len(serie) == 0:
            return "No hay datos válidos tras la limpieza.", 400

        # Análisis
        sentimientos = serie.apply(analizar_sentimiento)

        resultado_df = pd.DataFrame({
            "comentario": serie.values,
            "sentimiento": sentimientos.values
        })

        conteo = resultado_df["sentimiento"].value_counts()
        total = conteo.sum()
        porcentajes = (conteo / total * 100).round(1)

        # Gráfico
        colores = {"Positivo": "#4CAF50", "Neutral": "#BDBDBD", "Negativo": "#E53935"}
        fig, ax = plt.subplots(figsize=(8, 5))
        bars = ax.bar(conteo.index, conteo.values, color=[colores.get(i, "#000") for i in conteo.index])

        for bar, p in zip(bars, porcentajes):
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.1, f"{p}%", ha="center", weight="bold")

        img = BytesIO()
        plt.tight_layout()
        plt.savefig(img, format="png")
        img.seek(0)
        grafico = base64.b64encode(img.getvalue()).decode()
        plt.close(fig) # Liberar memoria

        # Excel
        excel = BytesIO()
        resultado_df.to_excel(excel, index=False)
        excel.seek(0)
        excel_b64 = base64.b64encode(excel.getvalue()).decode()

        logger.info("Análisis finalizado con éxito.")
        
        return render_template(
            "result.html",
            total=total,
            grafico=grafico,
            excel=excel_b64,
            user=session.get("user")
        )
    except Exception as e:
        logger.error(f"Error procesando el análisis: {e}", exc_info=True)
        return "Error interno al procesar el archivo.", 500

# ==============================
# 6. EJECUCIÓN
# ==============================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    logger.info(f"Servidor listo en puerto {port}")
    app.run(host="0.0.0.0", port=port)