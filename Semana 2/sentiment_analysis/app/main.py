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

# ==============================
# CONFIGURACIÓN DE LOGGING (DEBUG)
# ==============================
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# ==============================
# CONFIGURACIÓN APP
# ==============================

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "super-secret-key")

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
ALLOWED_DOMAIN = "gmail.com" 

# Log de inicio para verificar variables de entorno
logger.info("=== INICIANDO SISTEMA DE ANÁLISIS DE SENTIMIENTOS ===")
if not GOOGLE_CLIENT_ID:
    logger.error("CRÍTICO: GOOGLE_CLIENT_ID no configurado en variables de entorno.")
else:
    logger.info(f"GOOGLE_CLIENT_ID cargado: {GOOGLE_CLIENT_ID[:15]}...")

# ==============================
# VALIDAR TOKEN GOOGLE
# ==============================

def verify_google_token(token):
    try:
        logger.debug("Iniciando validación de token con Google...")
        
        idinfo = id_token.verify_oauth2_token(
            token,
            grequests.Request(),
            GOOGLE_CLIENT_ID
        )

        # DEBUG: Ver qué devuelve Google
        logger.debug(f"IDInfo obtenido exitosamente: Email: {idinfo.get('email')} | HD: {idinfo.get('hd')}")

        # NOTA: Las cuentas personales @gmail.com devuelven hd=None
        user_domain = idinfo.get("hd")
        user_email = idinfo.get("email", "")

        # Validación flexible: Si es gmail.com o el dominio coincide
        if ALLOWED_DOMAIN == "gmail.com":
            if not user_email.endswith("@gmail.com") and user_domain is None:
                logger.warning(f"Acceso denegado: {user_email} no es cuenta @gmail.com")
                return None
        elif user_domain != ALLOWED_DOMAIN:
            logger.warning(f"Acceso denegado: Dominio {user_domain} no autorizado.")
            return None

        return idinfo

    except ValueError as e:
        logger.error(f"Error: El token no es válido o ya expiró: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Error inesperado en verify_google_token: {str(e)}", exc_info=True)
        return None


# ==============================
# LOGIN
# ==============================

@app.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        token = data.get("credential")

        if not token:
            logger.warning("Solicitud de login sin 'credential' en el body.")
            return {"status": "no_token"}, 400

        logger.debug(f"Token recibido (primeros 20 caracteres): {token[:20]}...")
        user_info = verify_google_token(token)

        if user_info:
            session["user"] = {
                "name": user_info.get("name"),
                "email": user_info.get("email"),
                "picture": user_info.get("picture")
            }
            logger.info(f"LOGIN EXITOSO: Usuario {user_info.get('email')} ha iniciado sesión.")
            return {"status": "success"}
        else:
            return {"status": "unauthorized"}, 401
            
    except Exception as e:
        logger.error(f"Fallo en la ruta /login: {str(e)}")
        return {"status": "error"}, 500


@app.route("/logout")
def logout():
    user = session.get("user", {}).get("email", "Desconocido")
    session.clear()
    logger.info(f"LOGOUT: Usuario {user} cerró sesión.")
    return redirect("/")


# ==============================
# RUTA PRINCIPAL
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
        logger.warning("Intento de análisis sin sesión activa.")
        return redirect("/")

    try:
        archivo = request.files.get("file")
        if not archivo:
            logger.error("POST recibido pero no se encontró archivo.")
            return "No se subió ningún archivo", 400

        logger.info(f"Procesando archivo: {archivo.filename} para el usuario {session['user']['email']}")
        
        df = pd.read_excel(archivo)

        if df.shape[1] != 1:
            logger.warning(f"Archivo inválido: {df.shape[1]} columnas detectadas. Se requiere solo 1.")
            return "El archivo debe tener una sola columna", 400

        # Procesamiento
        serie = df.iloc[:, 0].dropna().astype(str)
        logger.debug(f"Registros iniciales: {len(serie)}")

        serie = serie.apply(normalizar_texto)
        serie = serie[~serie.isin(PALABRAS_GENERICAS)]
        serie = serie[~serie.apply(es_solo_simbolos)]
        serie = serie[~serie.apply(es_texto_basura)]
        serie = serie[serie.apply(tiene_palabras_validas)]

        logger.debug(f"Registros después de limpieza: {len(serie)}")

        if len(serie) == 0:
            logger.warning("El archivo quedó vacío tras la normalización.")
            return "No quedaron comentarios válidos para analizar tras la limpieza.", 400

        sentimientos = serie.apply(analizar_sentimiento)

        resultado_df = pd.DataFrame({
            "comentario": serie.values,
            "sentimiento": sentimientos.values
        })

        conteo = resultado_df["sentimiento"].value_counts()
        total = conteo.sum()
        porcentajes = (conteo / total * 100).round(1)

        logger.info(f"Análisis completado. Resultados: {conteo.to_dict()}")

        # Gráfico
        colores = {"Positivo": "#4CAF50", "Neutral": "#BDBDBD", "Negativo": "#E53935"}
        fig, ax = plt.subplots(figsize=(8, 5))
        bars = ax.bar(conteo.index, conteo.values, color=[colores.get(i, "#000") for i in conteo.index])

        for bar, p in zip(bars, porcentajes):
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.2, f"{p}%", ha="center", weight="bold")

        img = BytesIO()
        plt.tight_layout()
        plt.savefig(img, format="png")
        img.seek(0)
        grafico = base64.b64encode(img.getvalue()).decode()
        plt.close(fig) # Limpiar memoria

        # Excel de descarga
        excel = BytesIO()
        resultado_df.to_excel(excel, index=False)
        excel.seek(0)
        excel_b64 = base64.b64encode(excel.getvalue()).decode()

        return render_template(
            "result.html",
            total=total,
            grafico=grafico,
            excel=excel_b64,
            user=session.get("user")
        )
    except Exception as e:
        logger.error(f"Error procesando el análisis: {str(e)}", exc_info=True)
        return "Error interno al procesar el archivo.", 500


if __name__ == "__main__":
    puerto = int(os.environ.get("PORT", 8080))
    logger.info(f"Servidor escuchando en el puerto: {puerto}")
    app.run(host="0.0.0.0", port=puerto)