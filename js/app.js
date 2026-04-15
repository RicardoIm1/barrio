// ==================== CLASE PRINCIPAL ====================

class API {
    constructor() {
        this.baseUrl = API_BASE_URL;
    }

    // Método estático para obtener usuario actual
    static getUsuarioActual() {
        try {
            const usuario = localStorage.getItem('usuario');
            return usuario ? JSON.parse(usuario) : null;
        } catch (e) {
            console.error('Error parsing usuario:', e);
            return null;
        }
    }

    // Método estático para cerrar sesión
    static cerrarSesion() {
        localStorage.removeItem('usuario');
        localStorage.removeItem('api_key');
        // Disparar evento para actualizar UI
        window.dispatchEvent(new Event('storage'));
    }

    // Método principal para hacer peticiones JSONP
    static async peticion(accion, datos = {}, apiKey = null) {
        return new Promise((resolve, reject) => {
            const params = new URLSearchParams();
            params.append('accion', accion);
            
            if (apiKey) params.append('api_key', apiKey);
            
            // Para datos complejos, los enviamos como JSON string
            if (datos && Object.keys(datos).length > 0) {
                params.append('jsonp', JSON.stringify(datos));
            }
            
            const callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
            const url = `${API_BASE_URL}?callback=${callbackName}&${params.toString()}`;
            
            // Timeout por si falla
            const timeout = setTimeout(() => {
                if (window[callbackName]) {
                    delete window[callbackName];
                    reject(new Error('Timeout de conexión'));
                }
            }, 30000);
            
            window[callbackName] = function(response) {
                clearTimeout(timeout);
                delete window[callbackName];
                resolve(response);
            };
            
            const script = document.createElement('script');
            script.src = url;
            script.onerror = () => {
                clearTimeout(timeout);
                delete window[callbackName];
                reject(new Error('Error de conexión con el servidor'));
            };
            document.body.appendChild(script);
        });
    }

    // Método listar (conveniencia)
    static async listar(coleccion, filtros = {}, paginacion = {}) {
        const datos = {
            coleccion: coleccion,
            ...filtros,
            ...paginacion
        };
        return await API.peticion('LISTAR', datos);
    }

    // Método crear
    static async crear(coleccion, datos, apiKey) {
        return await API.peticion('CREAR', {
            coleccion: coleccion,
            datos: datos
        }, apiKey);
    }

    // Método actualizar
    static async actualizar(coleccion, id, datos, apiKey) {
        return await API.peticion('ACTUALIZAR', {
            coleccion: coleccion,
            id: id,
            datos: datos
        }, apiKey);
    }

    // Método eliminar
    static async eliminar(coleccion, id, apiKey) {
        return await API.peticion('ELIMINAR', {
            coleccion: coleccion,
            id: id
        }, apiKey);
    }

    // Método para estadísticas
    static async registrarVista(id) {
        return await API.peticion('REGISTRAR_VISTA', { id: id });
    }

    static async registrarClickWhatsApp(id) {
        return await API.peticion('REGISTRAR_CLICK_WHATSAPP', { id: id });
    }

    static async registrarInteres(id) {
        return await API.peticion('REGISTRAR_INTERES', { id: id });
    }

    // Método para obtener detalles de un aviso
    static async obtenerAviso(id) {
        const resultado = await API.listar('AVISOS', { id: id });
        if (resultado && resultado.datos && resultado.datos.length > 0) {
            return resultado.datos[0];
        }
        return null;
    }

    // Método para login
    static async login(email, password) {
        return await API.peticion('LOGIN', { email: email, password: password });
    }

    // Método para registro
    static async registro(datos) {
        return await API.peticion('REGISTRO', { datos: datos });
    }

    // Método para aprobar aviso (admin)
    static async aprobarAviso(id, apiKey) {
        return await API.peticion('APROBAR_AVISO', { id: id }, apiKey);
    }

    // Método para rechazar aviso (admin)
    static async rechazarAviso(id, apiKey) {
        return await API.peticion('RECHAZAR_AVISO', { id: id }, apiKey);
    }

    // Métodos de reputación
    static async miReputacion(apiKey) {
        return await API.peticion('MI_REPUTACION', {}, apiKey);
    }

    static async solicitarVerificacionTelefono(telefono, apiKey) {
        return await API.peticion('VERIFICAR_TELEFONO_SOLICITAR', { telefono: telefono }, apiKey);
    }

    static async confirmarVerificacionTelefono(codigo, apiKey) {
        return await API.peticion('VERIFICAR_TELEFONO_CONFIRMAR', { codigo: codigo }, apiKey);
    }

    static async votarAviso(avisoId, tipo, apiKey) {
        return await API.peticion('VOTAR_AVISO', { aviso_id: avisoId, tipo: tipo }, apiKey);
    }

    static async reportarAviso(avisoId, motivo, apiKey) {
        return await API.peticion('REPORTAR_AVISO', { aviso_id: avisoId, motivo: motivo }, apiKey);
    }
}

// ==================== FUNCIÓN DE RESPALDO PARA JSONP ====================

// Esta función permite llamadas directas sin usar la clase
window.llamarAPI = async function(accion, datos = {}, apiKey = null) {
    return await API.peticion(accion, datos, apiKey);
};

// ==================== INICIALIZACIÓN ====================

// Disparar evento cuando API está lista
document.addEventListener('DOMContentLoaded', () => {
    // Pequeño delay para asegurar que todo está listo
    setTimeout(() => {
        window.dispatchEvent(new CustomEvent('api-ready'));
        console.log('✅ API Client inicializado correctamente');
    }, 100);
});

// Hacer disponible globalmente
window.API = API;

// ==================== HELPER PARA DEPURACIÓN ====================

console.log('📡 API Client cargado. API_BASE_URL:', API_BASE_URL);