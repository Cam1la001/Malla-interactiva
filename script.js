let materias = [];
let materiasCompletadas = new Set();
let filtroNivelActual = 0;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch("malla.json");
    if (!response.ok) throw new Error("Error al cargar malla.json");
    materias = await response.json();
    
    procesarMaterias();
    
    document.getElementById("guardar-btn").addEventListener("click", guardarProgreso);
    document.getElementById("limpiar-btn").addEventListener("click", limpiarProgreso);
    document.getElementById("exportar-btn").addEventListener("click", descargarPDF);
    document.getElementById("aplicar-filtro").addEventListener("click", aplicarFiltroNivel);
    
    cargarProgreso();
    renderMalla();
    actualizarPlanificador();
    actualizarResumenProgreso();
  } catch (error) {
    console.error("Error inicial:", error);
    alert("Error al cargar los datos. Ver consola para detalles.");
  }
});

function procesarMaterias() {
  const mapaCodigos = new Map();
  
  materias.forEach((materia, index) => {
    materia.codigoNormalizado = normalizarCodigo(materia.codigo) || `M${index}`;
    
    if (mapaCodigos.has(materia.codigoNormalizado)) {
      console.warn(`Código duplicado: ${materia.codigoNormalizado} en "${materia.nombre}"`);
      materia.codigoNormalizado = `${materia.codigoNormalizado}-${index}`;
    }
    mapaCodigos.set(materia.codigoNormalizado, materia);
    
    materia.idUnico = `materia-${index}`;
    
    materia.prerequisitosValidos = (materia.prerequisitos || [])
      .filter(pr => pr && pr !== '')
      .map(normalizarCodigo)
      .map(codigo => {
        const encontrado = materias.find(m => normalizarCodigo(m.codigo) === codigo);
        if (!encontrado) {
          console.warn(`Prerrequisito no encontrado: "${codigo}" en "${materia.nombre}"`);
        }
        return encontrado?.idUnico;
      })
      .filter(Boolean);
  });
}

function normalizarCodigo(codigo) {
  if (!codigo) return '';
  return codigo.toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function aplicarFiltroNivel() {
  filtroNivelActual = parseInt(document.getElementById("filtro-nivel").value) || 0;
  renderMalla();
}

function renderMalla() {
  const container = document.getElementById("niveles-container");
  container.innerHTML = "";

  const materiasFiltradas = filtroNivelActual === 0 
    ? materias 
    : materias.filter(m => m.nivel === filtroNivelActual);

  const niveles = agruparPorNivel(materiasFiltradas);
  const nivelesOrdenados = Object.keys(niveles).sort((a, b) => a - b);
  
  nivelesOrdenados.forEach(nivel => {
    const columna = document.createElement("div");
    columna.className = "columna-nivel";

    const titulo = document.createElement("h2");
    titulo.textContent = `Nivel ${nivel}`;
    columna.appendChild(titulo);

    niveles[nivel].forEach(materia => {
      columna.appendChild(crearBloqueMateria(materia));
    });

    container.appendChild(columna);
  });
}

function crearBloqueMateria(materia) {
  const bloque = document.createElement("div");
  bloque.className = `materia ${materia.area}`;
  bloque.dataset.id = materia.idUnico;
  
  if (materiasCompletadas.has(materia.idUnico)) {
    bloque.classList.add("tachada");
  } else if (!puedeTomarse(materia)) {
    bloque.classList.add("bloqueada");
  }

  bloque.addEventListener("click", () => manejarClicMateria(materia));

  const tabla = document.createElement("div");
  tabla.className = "info-tabla";
  tabla.innerHTML = `
    <div class="celda">${materia.creditos} CR</div>
    <div class="celda">${materia.ht} HT</div>
    <div class="celda">${materia.hpr} HP</div>
    <div class="celda">${materia.curso || materia.codigoNormalizado}</div>
  `;

  const nombre = document.createElement("div");
  nombre.className = "nombre-materia";
  nombre.textContent = materia.nombre;

  bloque.appendChild(tabla);
  bloque.appendChild(nombre);

  return bloque;
}

function manejarClicMateria(materia) {
  if (materiasCompletadas.has(materia.idUnico)) {
    materiasCompletadas.delete(materia.idUnico);
  } else {
    if (!puedeTomarse(materia)) {
      const faltantes = materia.prerequisitosValidos
        .filter(id => !materiasCompletadas.has(id))
        .map(id => materias.find(m => m.idUnico === id)?.nombre)
        .filter(Boolean);
      
      if (faltantes.length > 0) {
        alert(`Prerrequisitos faltantes para "${materia.nombre}":\n${faltantes.join("\n")}`);
      }
      return;
    }
    materiasCompletadas.add(materia.idUnico);
  }
  
  guardarProgreso();
  renderMalla();
  actualizarPlanificador();
  actualizarResumenProgreso();
}

function puedeTomarse(materia) {
  return materia.prerequisitosValidos.every(id => materiasCompletadas.has(id));
}

function agruparPorNivel(materias) {
  const niveles = {};
  materias.forEach(m => {
    const nivel = m.nivel || "Sin Nivel";
    if (!niveles[nivel]) niveles[nivel] = [];
    niveles[nivel].push(m);
  });
  return niveles;
}

function guardarProgreso() {
  const idsCompletados = Array.from(materiasCompletadas);
  localStorage.setItem("materiasCompletadas", JSON.stringify(idsCompletados));
}

function cargarProgreso() {
  const data = localStorage.getItem("materiasCompletadas");
  if (data) {
    const ids = JSON.parse(data);
    materiasCompletadas = new Set(ids);
  }
}

function limpiarProgreso() {
  if (confirm("¿Estás seguro de que quieres borrar todo tu progreso?")) {
    localStorage.removeItem("materiasCompletadas");
    materiasCompletadas.clear();
    renderMalla();
    actualizarPlanificador();
    actualizarResumenProgreso();
  }
}

function actualizarResumenProgreso() {
  const totalMaterias = materias.length;
  const completadas = materiasCompletadas.size;
  const porcentaje = Math.round((completadas / totalMaterias) * 100);
  
  document.getElementById("barra-progreso").style.width = `${porcentaje}%`;
  document.getElementById("texto-progreso").textContent = `${porcentaje}% completado`;
  
  const creditosCompletados = materias
    .filter(m => materiasCompletadas.has(m.idUnico))
    .reduce((sum, m) => sum + (m.creditos || 0), 0);
  
  document.getElementById("total-creditos").textContent = `Créditos completados: ${creditosCompletados}`;
  document.getElementById("total-materias").textContent = `Materias completadas: ${completadas}/${totalMaterias}`;
}

function actualizarPlanificador() {
  const contenedor = document.getElementById("sugerencias-materias");
  contenedor.innerHTML = "";

  const ultimoNivelCompleto = calcularUltimoNivelCompleto();
  const disponibles = materias.filter(m => 
    !materiasCompletadas.has(m.idUnico) && 
    puedeTomarse(m)
  );

  if (disponibles.length === 0) {
    contenedor.innerHTML = `<p class="no-sugerencias">¡Felicidades! Has completado todas las materias.</p>`;
    return;
  }

  const opciones = [
    generarOpcionEstrategica(disponibles, ultimoNivelCompleto, 'estricto'),
    generarOpcionEstrategica(disponibles, ultimoNivelCompleto, 'flexible')
  ];

  opciones.forEach((opcion, i) => {
    const grupo = document.createElement("div");
    grupo.className = "opcion-planificador";
    
    const creditosTotales = opcion.reduce((sum, m) => sum + m.creditos, 0);
    const materiasDesbloqueadas = calcularTotalDesbloqueos(opcion);
    const nivelesIncluidos = [...new Set(opcion.map(m => m.nivel))].sort((a,b) => a-b);

    grupo.innerHTML = `
      <h3>Opción ${i+1} (${creditosTotales} créditos)</h3>
      <div class="detalles-opcion">
        <span>Niveles: ${nivelesIncluidos.join(', ')}</span>
        <span>Desbloquea: ${materiasDesbloqueadas} materias</span>
      </div>
      <div class="materias-lista">
        ${opcion.map(m => `
          <div class="materia-sugerida ${m.area}">
            <span>${m.nombre}</span>
            <span>${m.creditos}cr (N${m.nivel})</span>
          </div>
        `).join('')}
      </div>
    `;
    
    contenedor.appendChild(grupo);
  });
}

function generarOpcionEstrategica(materiasDisponibles, ultimoNivelCompleto, estrategia) {
  const seleccionadas = [];
  let creditosAcumulados = 0;
  const materiasPorNivel = agruparPorNivel(materiasDisponibles);
  
  if (estrategia === 'estricto') {
    const nivelPrioritario = ultimoNivelCompleto + 1;
    if (materiasPorNivel[nivelPrioritario]) {
      for (const materia of materiasPorNivel[nivelPrioritario]) {
        if (creditosAcumulados + materia.creditos <= 18) {
          seleccionadas.push(materia);
          creditosAcumulados += materia.creditos;
        }
      }
    }
    
    if (creditosAcumulados < 16) {
      for (let nivel = nivelPrioritario; nivel <= nivelPrioritario + 2; nivel++) {
        if (!materiasPorNivel[nivel]) continue;
        
        for (const materia of materiasPorNivel[nivel]) {
          if (seleccionadas.includes(materia)) continue;
          if (creditosAcumulados + materia.creditos <= 18) {
            seleccionadas.push(materia);
            creditosAcumulados += materia.creditos;
          }
          if (creditosAcumulados >= 16) break;
        }
        if (creditosAcumulados >= 16) break;
      }
    }
  } else {
    const nivelesConsiderar = [
      ultimoNivelCompleto + 1,
      ultimoNivelCompleto + 2,
      ultimoNivelCompleto + 3
    ].filter(n => n <= 10);

    const materiasOrdenadas = []
      .concat(...nivelesConsiderar.map(n => materiasPorNivel[n] || []))
      .sort((a, b) => {
        if (a.nivel !== b.nivel) return a.nivel - b.nivel;
        if (a.creditos !== b.creditos) return b.creditos - a.creditos;
        return contarDesbloqueos(b.idUnico) - contarDesbloqueos(a.idUnico);
      });

    for (const materia of materiasOrdenadas) {
      if (creditosAcumulados + materia.creditos <= 18) {
        seleccionadas.push(materia);
        creditosAcumulados += materia.creditos;
      }
      if (creditosAcumulados >= 16) break;
    }
  }

  return seleccionadas;
}

function calcularUltimoNivelCompleto() {
  const niveles = {};
  const totalPorNivel = {};
  
  materias.forEach(m => {
    totalPorNivel[m.nivel] = (totalPorNivel[m.nivel] || 0) + 1;
    if (materiasCompletadas.has(m.idUnico)) {
      niveles[m.nivel] = (niveles[m.nivel] || 0) + 1;
    }
  });
  
  let ultimoCompleto = 0;
  for (let nivel = 1; nivel <= 10; nivel++) {
    if (niveles[nivel] === totalPorNivel[nivel]) {
      ultimoCompleto = nivel;
    } else {
      break;
    }
  }
  
  return ultimoCompleto;
}

function contarDesbloqueos(idMateria) {
  return materias.filter(m => 
    m.prerequisitosValidos.includes(idMateria) && 
    !materiasCompletadas.has(m.idUnico)
  ).length;
}

function calcularTotalDesbloqueos(materiasSeleccionadas) {
  return materiasSeleccionadas.reduce((total, materia) => 
    total + contarDesbloqueos(materia.idUnico), 0);
}

function descargarPDF() {
  const element = document.createElement("div");
  element.className = "pdf-container";
  element.style.padding = "20px";
  
  element.innerHTML = `
    <h1 style="text-align: center; color: #2c3e50;">Planificación Académica - Ingeniería Mecatrónica</h1>
    <div class="pdf-progreso" style="margin-bottom: 20px;">
      <h2 style="color: #2c3e50; border-bottom: 1px solid #ddd;">Progreso Actual</h2>
      <p>${document.getElementById("texto-progreso").textContent}</p>
      <p>${document.getElementById("total-creditos").textContent}</p>
      <p>${document.getElementById("total-materias").textContent}</p>
    </div>
    <div class="pdf-malla" id="pdf-malla" style="margin-bottom: 30px;"></div>
    <div class="pdf-sugerencias">
      <h2 style="color: #2c3e50; border-bottom: 1px solid #ddd;">Sugerencias de Inscripción</h2>
      <div id="pdf-sugerencias"></div>
    </div>
  `;
  
  const mallaClone = document.getElementById("niveles-container").cloneNode(true);
  mallaClone.style.display = "grid";
  mallaClone.style.gridTemplateColumns = "repeat(5, 1fr)";
  mallaClone.style.gap = "10px";
  element.querySelector("#pdf-malla").appendChild(mallaClone);
  
  const sugerenciasClone = document.getElementById("sugerencias-materias").cloneNode(true);
  element.querySelector("#pdf-sugerencias").appendChild(sugerenciasClone);
  
  const opt = {
    margin: 10,
    filename: 'planificacion-mecatronica.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  
  html2pdf().set(opt).from(element).save();
}
