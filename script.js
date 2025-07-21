
let materias = [];
let materiasCompletadas = new Set();

document.addEventListener("DOMContentLoaded", async () => {
  const response = await fetch("malla.json");
  materias = await response.json();
  cargarProgreso();
  renderMalla();
  actualizarPlanificador();
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

/* ---------------- Planificador Inteligente ---------------- */

function actualizarPlanificador() {
  const contenedor = document.getElementById("sugerencias-materias");
  const totalCreditos = document.getElementById("total-creditos");
  contenedor.innerHTML = "";

  const disponibles = materias.filter((m) =>
    !materiasCompletadas.has(m.codigo) &&
    puedeTomarse(m) &&
    m.codigo // que tenga código
  );

  // Prioriza las materias que desbloquean más (más dependientes)
  disponibles.sort((a, b) => contarDesbloqueos(b.codigo) - contarDesbloqueos(a.codigo));

  let seleccionadas = [];
  let sumaCreditos = 0;
  for (const m of disponibles) {
    if (sumaCreditos + m.creditos <= 18) {
      seleccionadas.push(m);
      sumaCreditos += m.creditos;
    }
  }

  for (const mat of seleccionadas) {
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
    contenedor.appendChild(div);
  }

  totalCreditos.textContent = `Créditos sugeridos: ${sumaCreditos}`;
}

function contarDesbloqueos(codigo) {
  return materias.filter((m) => m.prerequisitos.includes(codigo)).length;
}
