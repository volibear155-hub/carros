'use strict';
/* =====================================================================
   DATOS EDITABLES: completa aquí tus valores reales.
   Mientras "ejemplo" sea true, la página avisa que es un dato de ejemplo.
   ===================================================================== */
const MARCA = 'Vireo';
const MODELO = 'Sendero';
const INTERVALO_SEG = 8;          // cada cuánto se vuelve a consultar el comparador
const CUPON = { codigo: 'AUTO5', descuento: 0.05 };
const CLAVE_CARRITO = 'vireo-carrito';

const VERSIONES = [
  { id: 'base', nombre: 'Base', precio: 89900000, cv: 120, consumo: 45, maletero: 430, ejemplo: true,
    potencia: 5, eficiencia: 9, espacio: 7, frase: 'La más económica y la que menos gasolina gasta.' },
  { id: 'intermedia', nombre: 'Intermedia', precio: 99900000, cv: 150, consumo: 42, maletero: 430, ejemplo: true,
    potencia: 7, eficiencia: 7, espacio: 7, frase: 'Equilibrio entre fuerza, consumo y precio.' },
  { id: 'full', nombre: 'Full', precio: 112900000, cv: 180, consumo: 38, maletero: 470, ejemplo: true,
    potencia: 9, eficiencia: 5, espacio: 8, frase: 'La más fuerte y con más espacio para carga.' }
];

// Competidores: los más vendidos de gama media en Colombia (ranking Andemos/RUNT 2026).
// Los precios son de referencia: confírmalos en el sitio oficial y actualiza "fecha" y "fuente".
function buscar(q) { return 'https://www.google.com/search?q=' + encodeURIComponent(q); }
const COMPETIDORES = [
  { id: 'duster', marca: 'Renault', modelo: 'Duster 1.3T Iconic', tipo: 'gasolina turbo', motor: '1.3 turbo', caja: 'CVT automática',
    precio: 111400000, cv: 150, fuente: 'prensa (Pulzo), puede estar desactualizada', fecha: 'por verificar', ejemplo: true,
    descripcion: 'El suv más popular por precio: robusto y cómodo en carretera destapada.',
    url: buscar('Renault Duster 2026 Colombia'), catalogo: 'https://www.renault.com.co/' },
  { id: 'cx30', marca: 'Mazda', modelo: 'CX-30 Grand Touring', tipo: 'híbrido ligero', motor: '2.0 MHEV', caja: 'automática',
    precio: 134000000, cv: 156, fuente: 'estimado, sin fuente oficial', fecha: 'por verificar', ejemplo: true,
    descripcion: 'Uno de los más vendidos del año: diseño cuidado y manejo ágil.',
    url: buscar('Mazda CX-30 2026 Colombia'), catalogo: 'https://www.mazda.com.co/' },
  { id: 'sportage', marca: 'Kia', modelo: 'Sportage 2.0 Desire', tipo: 'gasolina', motor: '2.0', caja: 'automática',
    precio: 142000000, cv: 156, fuente: 'estimado, sin fuente oficial', fecha: 'por verificar', ejemplo: true,
    descripcion: 'Suv familiar con buen espacio interior y mucha tecnología.',
    url: buscar('Kia Sportage 2026 Colombia'), catalogo: 'https://www.kia.com/co/' },
  { id: 'cross', marca: 'Toyota', modelo: 'Corolla Cross SEG híbrido', tipo: 'híbrido', motor: '1.8 híbrido', caja: 'CVT automática',
    precio: 147500000, cv: 122, fuente: 'prensa (Pulzo), puede estar desactualizada', fecha: 'por verificar', ejemplo: true,
    descripcion: 'Gasta poco y no tiene pico y placa por ser híbrido.',
    url: buscar('Toyota Corolla Cross 2026 Colombia'), catalogo: 'https://www.toyota.com.co/' }
];

/* ===== Utilidades ===== */
const $ = (id) => document.getElementById(id);
const pesos = (n) => '$' + new Intl.NumberFormat('es-CO').format(Math.round(n));

/* ===== Estado ===== */
let indice = 1;                    // versión elegida (Intermedia por defecto)
let competidores = [];             // última respuesta de la "API"
let segundos = INTERVALO_SEG;
let horaConsulta = '';
let carrito = { lineas: {}, cupon: false };

try {
  const g = JSON.parse(localStorage.getItem(CLAVE_CARRITO));
  if (g && g.lineas) {
    // Se descartan versiones que ya no existan
    Object.keys(g.lineas).forEach((id) => {
      if (VERSIONES.some((v) => v.id === id) && g.lineas[id] > 0) carrito.lineas[id] = g.lineas[id];
    });
    carrito.cupon = !!g.cupon;
  }
} catch (e) { /* si localStorage falla, se sigue sin guardar */ }

function guardar() {
  try { localStorage.setItem(CLAVE_CARRITO, JSON.stringify(carrito)); } catch (e) { /* sin almacenamiento */ }
}

/* ===== Aviso emergente ===== */
let temporizadorAviso;
function avisar(texto) {
  const a = $('aviso');
  a.textContent = texto;
  a.classList.add('ver');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => a.classList.remove('ver'), 2800);
}

/* ===== Vehículo y ficha técnica ===== */
function pintarVersiones() {
  $('versiones').innerHTML = VERSIONES.map((v, i) =>
    `<button type="button" data-i="${i}" aria-pressed="${i === indice}">${v.nombre}<small>${pesos(v.precio)}</small></button>`
  ).join('');
}

function pintarFicha() {
  const v = VERSIONES[indice];
  animarPrecio(v.precio);
  $('fraseVersion').textContent = v.frase;
  $('fichaDatos').innerHTML =
    `<dt>Potencia</dt><dd>${v.cv} CV</dd><dt>Consumo</dt><dd>${v.consumo} km/gal</dd><dt>Maletero</dt><dd>${v.maletero} L</dd>`;
  [['Potencia', v.potencia], ['Eficiencia', v.eficiencia], ['Espacio', v.espacio]].forEach(([n, val]) => {
    $('val' + n).textContent = val + '/10';
    $('bar' + n).style.width = val * 10 + '%';
  });
  $('notaEjemplo').textContent = v.ejemplo
    ? 'Precios y datos técnicos de las versiones: dato de ejemplo, aún sin confirmar.' : '';
}

/* ===== Comparador ===== */
// Simula una API: devuelve una promesa con retraso y precios fijos.
function compararPreciosAutos() {
  return new Promise((resolver) => {
    setTimeout(() => resolver(COMPETIDORES.map((c) => ({ ...c }))), 600);
  });
}

function consultar() {
  $('estadoComp').textContent = 'consultando precios…';
  compararPreciosAutos().then((datos) => {
    competidores = datos;
    horaConsulta = new Date().toLocaleTimeString('es-CO');
    segundos = INTERVALO_SEG;
    pintarComparador();
  });
}

let ultimaFirma = '';
function pintarComparador() {
  if (!competidores.length) { return; }
  const v = VERSIONES[indice];
  // Alerta amarilla si algún competidor cuesta menos que nuestra versión
  const baratos = competidores.filter((c) => c.precio < v.precio);
  $('alertaBarata').hidden = !baratos.length;
  $('alertaBarata').innerHTML = baratos.map((c) =>
    `Atención: ${c.marca} ${c.modelo} cuesta ${pesos(v.precio - c.precio)} menos que la versión ${v.nombre.toLowerCase()}.`).join('<br>');

  // Solo se redibujan las tarjetas si cambió algo (así la entrada animada no se repite cada 8 s)
  const firma = JSON.stringify([indice, competidores]);
  if (firma !== ultimaFirma) {
    ultimaFirma = firma;
    const filas = [{ id: 'nos', titulo: `${MARCA} ${MODELO}`, sub: 'versión ' + v.nombre.toLowerCase(), precio: v.precio, cv: v.cv, ejemplo: v.ejemplo,
        specs: [['Potencia', v.cv + ' CV'], ['Consumo', v.consumo + ' km/gal'], ['Maletero', v.maletero + ' L']], descripcion: v.frase },
      ...competidores.map((c) => ({ ...c, titulo: `${c.marca} ${c.modelo}`, sub: c.tipo,
        specs: [['Motor', c.motor], ['Caja', c.caja], ['Potencia', '~' + c.cv + ' CV']] }))];
    const minimo = Math.min(...filas.map((f) => f.precio));
    const maximo = Math.max(...filas.map((f) => f.precio));
    $('tarjetasComp').innerHTML = filas.map((f, n) => {
      const diff = f.id === 'nos' ? '' : (f.precio - v.precio >= 0
        ? `<p><b>Ahorras ${pesos(f.precio - v.precio)} con nosotros</b></p>`
        : `<p><b>Cuesta ${pesos(v.precio - f.precio)} menos que nosotros</b></p>`);
      const enlaces = f.id === 'nos' ? '' : `<p class="enlaces">
        <a class="btn peq" href="${f.url}" target="_blank" rel="noopener noreferrer">Ver el carro</a>
        <a class="btn btn-borde peq" href="${f.catalogo}" target="_blank" rel="noopener noreferrer">Catálogo oficial</a></p>`;
      const fuente = f.id === 'nos' ? '' : `<p><small>Fuente: ${f.fuente}. Consulta: ${f.fecha}.</small></p>`;
      return `<article class="fila ${f.precio === minimo ? 'barato' : 'caro'}" style="--i:${n}">
        <svg class="mini" viewBox="0 0 400 160" role="img" aria-label="ilustración de ${f.titulo}"><use href="#auto"/></svg>
        <h3>${f.titulo}</h3><p>${f.sub}</p>
        ${f.ejemplo ? '<span class="etq">dato de ejemplo</span>' : ''}
        <p>${f.descripcion}</p>
        <dl class="specs">${f.specs.map(([k, val]) => `<dt>${k}</dt><dd>${val}</dd>`).join('')}</dl>
        <p>Precio de lista: <b>${pesos(f.precio)}</b></p>
        <p>Por caballo de fuerza: <b>${pesos(f.precio / f.cv)}</b></p>
        <div class="barra" aria-hidden="true"><i style="width:${(f.precio / maximo) * 100}%"></i></div>
        ${diff}${fuente}${enlaces}</article>`;
    }).join('');
  }
  pintarEstado();
}

function pintarEstado() {
  $('estadoComp').textContent = `Última consulta: ${horaConsulta} · próxima en ${segundos} s`;
}

/* ===== Carrito ===== */
function pintarCarrito() {
  const ids = Object.keys(carrito.lineas);
  const unidades = ids.reduce((s, id) => s + carrito.lineas[id], 0);
  $('contador').textContent = unidades;
  $('carritoVacio').hidden = unidades > 0;
  $('carritoLleno').hidden = unidades === 0;

  $('lineas').innerHTML = ids.map((id) => {
    const v = VERSIONES.find((x) => x.id === id);
    const q = carrito.lineas[id];
    return `<li><span class="nom">${MARCA} ${MODELO} ${v.nombre.toLowerCase()}<br>${pesos(v.precio)} c/u</span>
      <button type="button" data-a="menos" data-id="${id}" aria-label="restar una unidad">−</button>
      <span>${q}</span>
      <button type="button" data-a="mas" data-id="${id}" aria-label="sumar una unidad">+</button>
      <b>${pesos(v.precio * q)}</b>
      <button type="button" class="quitar" data-a="quitar" data-id="${id}">Quitar</button></li>`;
  }).join('');

  const sub = ids.reduce((s, id) => s + VERSIONES.find((x) => x.id === id).precio * carrito.lineas[id], 0);
  const desc = carrito.cupon ? sub * CUPON.descuento : 0;
  $('subtotal').textContent = pesos(sub);
  $('filaDescuento').hidden = !carrito.cupon;
  $('descuento').textContent = '−' + pesos(desc);
  $('total').textContent = pesos(sub - desc);
}

function cambiarLinea(id, delta) {
  const n = (carrito.lineas[id] || 0) + delta;
  if (n > 0) carrito.lineas[id] = n; else delete carrito.lineas[id];
  if (!Object.keys(carrito.lineas).length) carrito.cupon = false;
  guardar(); pintarCarrito();
}

/* ===== Eventos ===== */
$('versiones').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  indice = Number(b.dataset.i);
  pintarVersiones(); pintarFicha(); pintarComparador();
  $('versiones').querySelector(`[data-i="${indice}"]`).focus();
});

$('btnAnadir').addEventListener('click', () => {
  const v = VERSIONES[indice];
  const q = Number($('cantidad').value);
  cambiarLinea(v.id, q);
  const c = $('contador');
  c.classList.remove('pulso'); void c.offsetWidth; c.classList.add('pulso');
  avisar(`Añadiste ${q} ${q === 1 ? 'unidad' : 'unidades'} de la versión ${v.nombre.toLowerCase()}.`);
});

$('btnCarrito').addEventListener('click', () => { location.hash = '#carrito'; });

$('lineas').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const { a, id } = b.dataset;
  cambiarLinea(id, a === 'mas' ? 1 : a === 'menos' ? -1 : -carrito.lineas[id]);
});

$('btnCupon').addEventListener('click', () => {
  const msg = $('msgCupon');
  if ($('cupon').value.trim().toUpperCase() === CUPON.codigo) {
    carrito.cupon = true; guardar(); pintarCarrito();
    msg.className = 'ok'; msg.textContent = 'Cupón aplicado: 5% de descuento.';
  } else {
    msg.className = 'error';
    msg.textContent = 'Ese código no es válido. Revisa que esté bien escrito y vuelve a intentarlo.';
  }
});

$('btnVaciar').addEventListener('click', () => {
  carrito = { lineas: {}, cupon: false };
  guardar(); pintarCarrito(); $('msgCupon').textContent = ''; $('msgPago').textContent = '';
});

$('btnFinalizar').addEventListener('click', () => {
  $('msgPago').textContent = 'El pago aún no está conectado. Esta es una versión de prueba.';
});

/* ===== Animaciones ===== */
const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let precioMostrado = 0;
// El precio "cuenta" hasta el nuevo valor al cambiar de versión
function animarPrecio(hasta) {
  const el = $('precioVersion');
  if (sinMovimiento) { el.textContent = pesos(hasta); precioMostrado = hasta; return; }
  const desde = precioMostrado, t0 = performance.now();
  (function paso(t) {
    const p = Math.min((t - t0) / 600, 1);
    precioMostrado = desde + (hasta - desde) * (1 - Math.pow(1 - p, 3));
    el.textContent = pesos(precioMostrado);
    if (p < 1) requestAnimationFrame(paso);
  })(t0);
}
// Los bloques aparecen suavemente al llegar a la pantalla
const bloques = document.querySelectorAll('#vehiculo h2, .dos > div, #comparador h2, #comparador > p, #carrito h2, #carrito > div');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('visto'); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  bloques.forEach((el) => { el.classList.add('reveal'); io.observe(el); });
}

/* ===== Arranque ===== */
pintarVersiones(); pintarFicha(); pintarCarrito(); consultar();
setInterval(() => {
  segundos -= 1;
  if (segundos <= 0) consultar(); else if (horaConsulta) pintarEstado();
}, 1000);
