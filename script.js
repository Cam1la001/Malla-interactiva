// script.js

const nivelesContainer = document.getElementById("niveles-container");
const sugerenciasDiv = document.getElementById("sugerencias-materias");
const totalCreditosSpan = document.getElementById("total-creditos");
const exportarBtn = document.getElementById("exportar-btn");
const limpiarBtn = document.getElementById("limpiar-btn");

let materias = [];

fetch("materias.json")
  .then(res => res.json())
  .then(data => {
    materias = data;
    construirMalla();
    cargarProgreso();
    actualizarBloqueo();
    actualizarPlanificador();
  });

function construirMalla() {
  nivelesContainer.innerHTML = "";
  const niveles = [...new Set(materias.map(m => m.nivel))].sort((a, b) => a - b);
  niveles.forEach(nivel => {
    const col = document.createElement("div");
    col.className = "columna-nivel";
    const titulo = document.createElement("h2");
    titulo.textContent = `Nivel ${nivel}`;
    col.appendChild(titulo);

    materias.filter(m => m.nivel === nivel).forEach(materia => {
      const card = crearTarjetaMateria(materia);
      col.appendChild(card);
    });

    nivelesContainer.appendChild(col);
  });
}

function crearTarjetaMateria(materia) {
  const div = document.createElement("div");
  div.className = `materia ${materia.area}`;
  div.dataset.curso = materia.curso;
  div.dataset.codigo = materia.codigo || "";
  div.dataset.nivel = materia.nivel;
  div.dataset.creditos = materia.creditos;

  const tabla = document.createElement("div");
  tabla.className = "info-tabla";
  const columnas = [
    materia.codigo || "", materia.area, materia.curso, materia.creditos, materia.ht, materia.hpr, (materia.prerequisitos || []).join(", ")
  ];
  columnas.forEach(c => {
    const celda = document.createElement("div");
    celda.className = "celda";
    celda.textContent = c;
    tabla.appendChild(celda);
  });

  const nombre = document.createElement("div");
  nombre.className = "nombre-materia";
  nombre.textContent = materia.nombre;

  div.appendChild(tabla);
  div.appendChild(nombre);

  div.addEventListener("click", () => {
    div.classList.toggle("tachada");
    actualizarBloqueo();
    guardarProgreso();
    actualizarPlanificador();
  });

  return div;
}

function actualizarBloqueo() {
  const tachadas = Array.from(document.querySelectorAll(".materia.tachada"))
    .map(m => m.dataset.curso);

  materias.forEach(m => {
    const card = document.querySelector(`.materia[data-curso='${m.curso}']`);
    if (!card) return;

    if (tachadas.includes(m.curso)) {
      card.classList.remove("bloqueada");
      return;
    }

    const requisitosCumplidos = (m.prerequisitos || []).every(req => tachadas.includes(req));
    if (!requisitosCumplidos) {
      card.classList.add("bloqueada");
    } else {
      card.classList.remove("bloqueada");
    }
  });
}

function guardarProgreso() {
  const tachadas = Array.from(document.querySelectorAll(".materia.tachada"))
    .map(m => m.dataset.curso);
  localStorage.setItem("materiasCompletadas", JSON.stringify(tachadas));
}

function cargarProgreso() {
  const saved = JSON.parse(localStorage.getItem("materiasCompletadas")) || [];
  saved.forEach(curso => {
    const card = document.querySelector(`.materia[data-curso='${curso}']`);
    if (card) card.classList.add("tachada");
  });
}

function limpiarProgreso() {
  document.querySelectorAll(".materia.tachada").forEach(m => m.classList.remove("tachada"));
  guardarProgreso();
  actualizarBloqueo();
  actualizarPlanificador();
}

function actualizarPlanificador() {
  sugerenciasDiv.innerHTML = "";
  const tachadas = Array.from(document.querySelectorAll(".materia.tachada"))
    .map(m => m.dataset.curso);

  const nivelesPendientes = [...new Set(materias
    .filter(m => !tachadas.includes(m.curso))
    .map(m => m.nivel))].sort((a, b) => a - b);
  const nivelesObjetivo = nivelesPendientes.slice(0, 2);

  const disponibles = materias.filter(m =>
    nivelesObjetivo.includes(m.nivel) &&
    !tachadas.includes(m.curso) &&
    (m.prerequisitos || []).every(req => tachadas.includes(req))
  );

  const combinaciones = generarCombinaciones(disponibles, 18);
  const evaluadas = combinaciones.map(combo => {
    const peso = combo.reduce((sum, mat) => {
      const desbloqueadas = materias.filter(m2 =>
        !tachadas.includes(m2.curso) &&
        (m2.prerequisitos || []).includes(mat.curso)
      ).length;
      return sum + desbloqueadas;
    }, 0);
    return { combo, peso, creditos: combo.reduce((s, m) => s + m.creditos, 0) };
  });

  evaluadas.sort((a, b) => b.peso - a.peso || b.creditos - a.creditos);

  [0, 1].forEach(i => {
    const pack = evaluadas[i];
    if (!pack) return;
    const contenedor = document.createElement("div");
    contenedor.style.marginBottom = "20px";
    pack.combo.forEach(m => {
      const card = crearTarjetaMateria(m);
      contenedor.appendChild(card);
    });
    const label = document.createElement("p");
    label.textContent = `Opción ${i + 1}: ${pack.creditos} créditos, desbloquea ${pack.peso}`;
    sugerenciasDiv.appendChild(label);
    sugerenciasDiv.appendChild(contenedor);
  });

  totalCreditosSpan.textContent = `Créditos sugeridos: ${evaluadas[0]?.creditos || 0}`;
}

function generarCombinaciones(lista, maxCreditos) {
  const resultado = [];

  function backtrack(start, combo, suma) {
    if (suma <= maxCreditos && combo.length > 0) {
      resultado.push([...combo]);
    }
    for (let i = start; i < lista.length; i++) {
      const m = lista[i];
      if (suma + m.creditos <= maxCreditos) {
        combo.push(m);
        backtrack(i + 1, combo, suma + m.creditos);
        combo.pop();
      }
    }
  }

  backtrack(0, [], 0);
  return resultado;
}

// --------------------------
// Exportar como PDF
// --------------------------
exportarBtn?.addEventListener("click", () => {
  window.print();
});

limpiarBtn?.addEventListener("click", () => {
  limpiarProgreso();
});
