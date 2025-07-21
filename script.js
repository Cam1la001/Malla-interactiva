let materias = [];
let materiasCompletadas = new Set();

document.addEventListener("DOMContentLoaded", async () => {
  const response = await fetch("materias.json");
  materias = await response.json();
  cargarProgreso();
  renderMalla();
  actualizarPlanificador();
  document.getElementById("limpiar-btn").onclick = limpiarProgreso;
  document.getElementById("exportar-btn").onclick = descargarPDF;
});

function renderMalla() {
  const container = document.getElementById("niveles-container");
  container.innerHTML = "";

  const niveles = agruparPorNivel(materias);
  for (const nivel in niveles) {
    const columna = document.createElement("div");
    columna.className = "columna-nivel";

    const titulo = document.createElement("h2");
    titulo.textContent = `Nivel ${nivel}`;
    columna.appendChild(titulo);

    niveles[nivel].forEach((materia) => {
      const bloque = crearBloqueMateria(materia);
      columna.appendChild(bloque);
    });

    container.appendChild(columna);
  }
}

function crearBloqueMateria(materia) {
  const bloque = document.createElement("div");
  bloque.className = `materia ${materia.area}`;
  if (materiasCompletadas.has(materia.codigo)) {
    bloque.classList.add("tachada");
  } else if (!puedeTomarse(materia)) {
    bloque.classList.add("bloqueada");
  }

  bloque.onclick = () => {
    if (!puedeTomarse(materia)) return;
    if (materiasCompletadas.has(materia.codigo)) {
      materiasCompletadas.delete(materia.codigo);
    } else {
      materiasCompletadas.add(materia.codigo);
    }
    guardarProgreso();
    renderMalla();
    actualizarPlanificador();
  };

  const tabla = document.createElement("div");
  tabla.className = "info-tabla";

  tabla.innerHTML = `
    <div class="celda small">${materia.codigo || "-"}</div>
    <div class="celda small">${materia.creditos}</div>
    <div class="celda small">${materia.ht}</div>
    <div class="celda small">${materia.hpr}</div>
    <div class="celda small">${materia.curso}</div>
    <div class="celda small">${materia.area}</div>
    <div class="celda small">${materia.prerequisitos.join(", ") || "-"}</div>
  `;

  const nombre = document.createElement("div");
  nombre.className = "nombre-materia";
  nombre.textContent = materia.nombre;

  bloque.appendChild(tabla);
  bloque.appendChild(nombre);

  return bloque;
}

function agruparPorNivel(materias) {
  const niveles = {};
  materias.forEach((m) => {
    const nivel = m.nivel || "Sin Nivel";
    if (!niveles[nivel]) niveles[nivel] = [];
    niveles[nivel].push(m);
  });
  return niveles;
}

function puedeTomarse(materia) {
  return materia.prerequisitos.every((pr) => materiasCompletadas.has(pr));
}

function guardarProgreso() {
  localStorage.setItem("materiasCompletadas", JSON.stringify([...materiasCompletadas]));
}

function cargarProgreso() {
  const data = localStorage.getItem("materiasCompletadas");
  if (data) materiasCompletadas = new Set(JSON.parse(data));
}

function limpiarProgreso() {
  localStorage.removeItem("materiasCompletadas");
  materiasCompletadas.clear();
  renderMalla();
  actualizarPlanificador();
}

/* -------- Planificador Inteligente -------- */
function actualizarPlanificador() {
  const contenedor = document.getElementById("sugerencias-materias");
  contenedor.innerHTML = "";

  const disponibles = materias.filter((m) =>
    !materiasCompletadas.has(m.codigo) && puedeTomarse(m)
  );

  const niveles = agruparPorNivel(materias);
  const nivelesFaltantes = Object.keys(niveles)
    .filter(n => niveles[n].some(m => !materiasCompletadas.has(m.codigo)))
    .map(n => parseInt(n)).sort((a, b) => a - b);

  const proximos = nivelesFaltantes.slice(0, 2);

  const porProximidad = disponibles.map(m => {
    return {
      ...m,
      prioridad: proximos.includes(parseInt(m.nivel)) ? 1 : 2,
      desbloqueos: contarDesbloqueos(m.codigo)
    };
  });

  porProximidad.sort((a, b) => {
    if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad;
    return b.desbloqueos - a.desbloqueos;
  });

  const opciones = generarOpciones(porProximidad, 2);

  opciones.forEach((opcion, i) => {
    const grupo = document.createElement("div");
    grupo.innerHTML = `<h3>Opción ${i + 1}:</h3>`;
    let sumaCreditos = 0;

    opcion.forEach((mat) => {
      const div = document.createElement("div");
      div.className = `materia ${mat.area}`;
      div.innerHTML = `
        <div class="info-tabla">
          <div class="celda small">${mat.codigo}</div>
          <div class="celda small">${mat.creditos}</div>
          <div class="celda small">${mat.ht}</div>
          <div class="celda small">${mat.hpr}</div>
          <div class="celda small">${mat.curso}</div>
          <div class="celda small">${mat.area}</div>
          <div class="celda small">${mat.prerequisitos.join(", ") || "-"}</div>
        </div>
        <div class="nombre-materia">${mat.nombre}</div>
      `;
      sumaCreditos += mat.creditos;
      grupo.appendChild(div);
    });

    const total = document.createElement("div");
    total.className = "total-creditos";
    total.textContent = `Total créditos: ${sumaCreditos}/18`;
    grupo.appendChild(total);

    contenedor.appendChild(grupo);
  });
}

function contarDesbloqueos(codigo) {
  return materias.filter((m) => m.prerequisitos.includes(codigo)).length;
}

function generarOpciones(lista, numOpciones) {
  const opciones = [];
  for (let i = 0; i < numOpciones; i++) {
    const seleccionadas = [];
    let suma = 0;
    const usados = new Set();

    for (const m of lista) {
      if (!usados.has(m.codigo) && suma + m.creditos <= 18) {
        seleccionadas.push(m);
        usados.add(m.codigo);
        suma += m.creditos;
      }
    }

    // Reordenar la lista para que la siguiente opción sea distinta
    lista.push(lista.shift());
    opciones.push(seleccionadas);
  }
  return opciones;
}

/* -------- Exportar como PDF -------- */
function descargarPDF() {
  window.print();
}
