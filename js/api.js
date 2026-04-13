  const API = {
   baseUrl: 'https://script.google.com/macros/s/AKfycbxNCWY2g5VkMNYXN8dmywt_ElACDM17Z-riMMU_ocm7oswRQGc76ErYhA-DlOmVTgk4/exec',
  
  async peticion(accion, coleccion = null, datos = {}, id = null, consulta = {}, paginacion = {}) {
    return new Promise((resolve, reject) => {
      const callbackName = 'jsonp_callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      
      const payload = {
        accion: accion,
        coleccion: coleccion,
        datos: datos,
        id: id,
        consulta: consulta,
        paginacion: paginacion,
        callback: callbackName
      };
      
      const url = this.baseUrl + '?jsonp=' + encodeURIComponent(JSON.stringify(payload));
      
      window[callbackName] = function(data) {
        delete window[callbackName];
        document.body.removeChild(script);
        if (data.success) {
          resolve(data.data);
        } else {
          reject(new Error(data.error));
        }
      };
      
      const script = document.createElement('script');
      script.src = url;
      script.onerror = () => {
        delete window[callbackName];
        document.body.removeChild(script);
        reject(new Error('Error de conexión'));
      };
      document.body.appendChild(script);
    });
  },
  
  listar: function(coleccion, consulta = {}, paginacion = {}) {
    return this.peticion('LISTAR', coleccion, {}, null, consulta, paginacion);
  }
};