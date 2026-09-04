// ==========================================================
// SUPABASE CLIENT
// ==========================================================

const SUPABASE_URL = 'https://gnjaumpjerbbwlkcgxqa.supabase.co';

const SUPABASE_ANON_KEY = 'sb_publishable_x01F_xzyh5b-sZdwhKh6FQ_OzQVxMpN';

// Una sola instancia compartida por toda la aplicación.
const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

window.__elBarrioSupabaseClient = supabaseClient;
window.supabaseClient = supabaseClient;

// Compatibilidad: evita que el panel de usuario normal intente cargar
// funciones exclusivas de administración cuando admin.js se inicializa.
(function protegerCargaUsuariosAdmin() {
    const iniciar = () => {
        let intentos = 0;
        const timer = setInterval(() => {
            intentos++;
            if (typeof window.cargarUsuariosAdmin !== 'function') {
                if (intentos >= 100) clearInterval(timer);
                return;
            }
            if (window.cargarUsuariosAdmin.__elBarrioGuarded) {
                clearInterval(timer);
                return;
            }
            const original = window.cargarUsuariosAdmin;
            const guardada = async function (...args) {
                const usuario = window.API?.getUsuarioActual?.();
                if (usuario && usuario.rol !== 'admin') {
                    console.log('ℹ️ Lista de usuarios omitida: sesión sin privilegios de administrador.');
                    return null;
                }
                return original.apply(this, args);
            };
            guardada.__elBarrioGuarded = true;
            window.cargarUsuariosAdmin = guardada;
            clearInterval(timer);
        }, 50);
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar, { once: true });
    } else {
        iniciar();
    }
})();

// Compatibilidad de fecha para el modal de edición: los campos type="date"
// aceptan yyyy-MM-dd, aunque PostgreSQL pueda devolver un timestamp.
(function normalizarCampoFechaEdicion() {
    const instalar = () => {
        const campo = document.getElementById('edit-fecha_evento');
        if (!campo || campo.dataset.elBarrioDateReady === '1') return;
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        if (!descriptor?.set || !descriptor?.get) return;
        Object.defineProperty(campo, 'value', {
            configurable: true,
            enumerable: descriptor.enumerable,
            get() {
                return descriptor.get.call(this);
            },
            set(valor) {
                let normalizado = valor == null ? '' : String(valor);
                if (this.type === 'date' && normalizado.includes('T')) {
                    normalizado = normalizado.split('T')[0];
                }
                descriptor.set.call(this, normalizado);
            }
        });
        campo.dataset.elBarrioDateReady = '1';
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', instalar, { once: true });
    } else {
        instalar();
    }
})();

console.log('✅ Supabase conectado: instancia única compartida');