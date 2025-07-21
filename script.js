let materias = [];
let materiasCompletadas = new Set();
let filtroNivelActual = 0;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Cargar datos
    const response = await fetch("malla.json");
    if (!response.ok) throw new Error("Error al cargar el archivo malla.json");
    materias = await response.json();
    
    // Validar materias
    validarMaterias();
    
    // Configurar eventos
    document.getElementById("guardar-btn").addEventListener("click", guardarProgreso);
    document.getElementById("limpiar-btn").addEventListener("click", limpiarProgreso);
    document.getElementById("exportar-btn").addEventListener("click", descargarPDF);
    document.getElementById("aplicar-filtro").addEventListener("click", aplicarFiltroNivel);
    
    // Inicializar
    cargarProgreso();
    renderMalla();
    actualizarPlanificador();
    actualizarResumenProgreso();
  } catch (error) {
    console.error("Error inicial:", error);
    alert("Error al cargar los datos. Por favor recarga la página.");
  }
});

function validarMaterias() {
  const problemas = [];
  const codigosUnicos = new Set();
  
  materias.forEach((materia, index) => {
    // Validar nombre
    if (!materia.nombre || materia.nombre.trim() === "") {
      problemas.push(`Materia en posición ${index} no tiene nombre`);
    }
    
    // Validar y normalizar código
    const codigo = obtenerCodigoMateria(materia);
    if (!codigo || codigo.trim() === "") {
      problemas.push(`Materia "${materia.nombre}" no tiene código válido`);
    } else if (codigosUnicos.has(codigo)) {
      problemas.push(`Código duplicado: ${codigo} en "${materia.nombre}"`);
    } else {
      codigosUnicos.add(codigo);
      // Normalizar código en el objeto materia
      materia.codigo = codigo;
    }
    
    // Validar créditos
    if (typeof materia.creditos !== 'number' || isNaN(materia.creditos)) {
      problemas.push(`Materia "${materia.nombre}" no tiene créditos válidos`);
      materia.creditos = 0; // Valor por defecto
    }
    
    // Validar prerrequisitos
    if (materia.prerequisitos && !Array.isArray(materia.prerequisitos)) {
      problemas.push(`Prerrequisitos no son array en "${materia.nombre}"`);
      materia.prerequisitos = [];
    }
  });
  
  if (problemas.length > 0) {
    console.warn("Problemas encontrados en los datos:", problemas);
    // Opcional: mostrar advertencia al usuario
    if (problemas.length > 5) {
      alert(`Se encontraron ${problemas.length} problemas en los datos. Ver la consola para detalles.`);
    }
  }
}

function obtenerCodigoMateria(materia) {
  if (!materia.codigo) {
    // Generar código basado en nombre si no existe
    return materia.nombre
      .replace(/\s+/g, '')
      .substring(0, 8)
      .toUpperCase();
  }
  if (Array.isArray(materia.codigo)) {
    return materia.codigo[0]?.toString().trim() || 
           materia.nombre.replace(/\s+/g, '').substring(0, 8).toUpperCase();
  }
  return materia.codigo.toString().trim();
}

function aplicarFiltroNivel() {
  filtroNivelActual = parseInt(document.getElementById("filtro-nivel").value) || 0;
  renderMalla();
}

function renderMalla() {
  const container = document.getElementById("niveles-container");
  container.innerHTML = "";

  // Filtrar materias por nivel si hay filtro activo
  const materiasFiltradas = filtroNivelActual === 0 
    ? materias 
    : materias.filter(m => m.nivel === filtroNivelActual);

  const niveles = agruparPorNivel(materiasFiltradas);
  
  // Ordenar niveles numéricamente
  const nivelesOrdenados = Object.keys(niveles).sort((a, b) => a - b);
  
  for (const nivel of nivelesOrdenados) {
    const columna = document.createElement("div");
    columna.className = "columna-nivel";

    const titulo = document.createElement("h2");
    titulo.textContent = `Nivel ${nivel}`;
    columna.appendChild(titulo);

    // Ordenar materias por código
    const materiasNivel = niveles[nivel].sort((a, b) => {
      const codA = obtenerCodigoMateria(a);
      const codB = obtenerCodigoMateria(b);
      return codA.localeCompare(codB);
    });

    materiasNivel.forEach((materia) => {
      const bloque = crearBloqueMateria(materia);
      if (bloque) columna.appendChild(bloque);
    });

    container.appendChild(columna);
  }
}

function crearBloqueMateria(materia) {
  const bloque = document.createElement("div");
  bloque.className = `materia ${materia.area}`;
  
  // Obtener código de materia
  const codigoMateria = obtenerCodigoMateria(materia);
  
  // Configurar estados
  if (codigoMateria && materiasCompletadas.has(codigoMateria)) {
    bloque.classList.add("tachada");
  } else if (!puedeTomarse(materia)) {
    bloque.classList.add("bloqueada");
  }

  // Configurar evento de clic
  bloque.addEventListener("click", function() {
    // Solo materias con código pueden marcarse
    if (!codigoMateria) {
      console.warn("Intento de marcar materia sin código:", materia.nombre);
      return;
    }
    
    // Verificar si está bloqueada
    if (this.classList.contains("bloqueada")) {
      const faltantes = (materia.prerequisitos || []).filter(pr => 
        !materiasCompletadas.has(pr.toString())
      );
      
      if (faltantes.length > 0) {
        alert(`Para tomar "${materia.nombre}" necesitas completar:\n${faltantes.join("\n")}`);
      } else {
        alert(`"${materia.nombre}" no se puede marcar. Falta información de prerrequisitos.`);
      }
      return;
    }
    
    // Alternar estado
    if (materiasCompletadas.has(codigoMateria)) {
      materiasCompletadas.delete(codigoMateria);
      this.classList.remove("tachada");
    } else {
      materiasCompletadas.add(codigoMateria);
      this.classList.add("tachada");
    }
    
    guardarProgreso();
    actualizarPlanificador();
    actualizarResumenProgreso();
  });

  // Crear contenido
  const tabla = document.createElement("div");
  tabla.className = "info-tabla";
  tabla.innerHTML = `
    <div class="celda">${materia.creditos} CR</div>
    <div class="celda">${materia.ht} HT</div>
    <div class="celda">${materia.hpr} HP</div>
    <div class="celda">${materia.curso || codigoMateria}</div>
  `;

  const nombre = document.createElement("div");
  nombre.className = "nombre-materia";
  nombre.textContent = materia.nombre;

  // Tooltip con prerrequisitos
  if (materia.prerequisitos?.length > 0) {
    bloque.title = `Prerrequisitos: ${materia.prerequisitos.join(", ")}`;
  }

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
  const codigoMateria = obtenerCodigoMateria(materia);
  if (!codigoMateria) return false;
  
  // Si ya está completada, se puede desmarcar
  if (materiasCompletadas.has(codigoMateria)) return true;
  
  // Verificar prerrequisitos
  const prerequisitos = materia.prerequisitos || [];
  return prerequisitos.every(pr => {
    const codigoPr = pr?.toString()?.trim() || "";
    return codigoPr === "" || materiasCompletadas.has(codigoPr);
  });
}

function guardarProgreso() {
  const codigosCompletados = Array.from(materiasCompletadas).filter(c => c && c.trim() !== "");
  try {
    localStorage.setItem("materiasCompletadas", JSON.stringify(codigosCompletados));
    console.log("Progreso guardado:", codigosCompletados);
  } catch (e) {
    console.error("Error al guardar progreso:", e);
  }
}

function cargarProgreso() {
  try {
    const data = localStorage.getItem("materiasCompletadas");
    if (data) {
      const codigos = JSON.parse(data);
      // Filtrar solo códigos válidos (strings no vacíos)
      materiasCompletadas = new Set(codigos.filter(c => 
        c && typeof c === 'string' && c.trim().length > 0
      ));
      console.log("Progreso cargado:", materiasCompletadas);
    }
  } catch (e) {
    console.error("Error al cargar progreso:", e);
    materiasCompletadas = new Set();
  }
}

function limpiarProgreso() {
  if (confirm("¿Estás seguro de que quieres borrar todo tu progreso?")) {
    try {
      localStorage.removeItem("materiasCompletadas");
      materiasCompletadas.clear();
      renderMalla();
      actualizarPlanificador();
      actualizarResumenProgreso();
      console.log("Progreso limpiado");
    } catch (e) {
      console.error("Error al limpiar progreso:", e);
    }
  }
}

function actualizarResumenProgreso() {
  const totalMaterias = materias.filter(m => obtenerCodigoMateria(m) !== "").length;
  const completadas = materiasCompletadas.size;
  const porcentaje = totalMaterias > 0 ? Math.round((completadas / totalMaterias) * 100) : 0;
  
  // Actualizar barra de progreso
  document.getElementById("barra-progreso").style.width = `${porcentaje}%`;
  document.getElementById("texto-progreso").textContent = `${porcentaje}% completado`;
  
  // Calcular créditos completados
  const creditosCompletados = materias
    .filter(m => {
      const codigo = obtenerCodigoMateria(m);
      return codigo && materiasCompletadas.has(codigo);
    })
    .reduce((sum, m) => sum + (m.creditos || 0), 0);
  
  // Actualizar textos
  document.getElementById("total-creditos").textContent = `Créditos completados: ${creditosCompletados}`;
  document.getElementById("total-materias").textContent = `Materias completadas: ${completadas}/${totalMaterias}`;
}

/* -------- Planificador Inteligente -------- */
function actualizarPlanificador() {
  const contenedor = document.getElementById("sugerencias-materias");
  contenedor.innerHTML = "";

  // Filtrar materias disponibles (con código, no completadas y que se pueden tomar)
  const disponibles = materias.filter(m => {
    const codigo = obtenerCodigoMateria(m);
    return codigo && 
           !materiasCompletadas.has(codigo) && 
           puedeTomarse(m);
  });

  // Si no hay materias disponibles
  if (disponibles.length === 0) {
    contenedor.innerHTML = `<p class="no-sugerencias">¡Felicidades! Has completado todas las materias disponibles.</p>`;
    return;
  }

  // Calcular peso para cada materia
  const materiasConPeso = disponibles.map(m => {
    const codigo = obtenerCodigoMateria(m);
    return {
      ...m,
      peso: calcularPesoMateria(m)
    };
  });

  // Ordenar por peso descendente
  materiasConPeso.sort((a, b) => b.peso - a.peso);

  // Generar dos opciones distintas
  const opciones = [
    generarOpcionInscripcion([...materiasConPeso]),
    generarOpcionInscripcion([...materiasConPeso].reverse())
  ];

  // Mostrar las opciones
  opciones.forEach((opcion, index) => {
    const grupo = document.createElement("div");
    grupo.className = "opcion-planificador";
    grupo.innerHTML = `<h3>Opción ${index + 1}:</h3>`;
    
    let creditosTotales = 0;
    
    opcion.forEach(materia => {
      creditosTotales += materia.creditos;
      
      const divMateria = document.createElement("div");
      divMateria.className = `materia-sugerida ${materia.area}`;
      divMateria.innerHTML = `
        <span>${materia.nombre}</span>
        <span>${materia.creditos} cr. (Nivel ${materia.nivel})</span>
      `;
      
      grupo.appendChild(divMateria);
    });
    
    // Mostrar total de créditos
    const divTotal = document.createElement("div");
    divTotal.className = "total-creditos";
    divTotal.textContent = `Total: ${creditosTotales}/18 créditos`;
    grupo.appendChild(divTotal);
    
    contenedor.appendChild(grupo);
  });
}

function calcularPesoMateria(materia) {
  const codigo = obtenerCodigoMateria(materia);
  const creditos = materia.creditos || 0;
  const nivel = materia.nivel || 10;
  
  // 1. Materias que desbloquean más materias tienen mayor peso
  const desbloqueos = contarDesbloqueos(codigo);
  
  // 2. Materias de niveles más bajos tienen mayor peso
  const pesoNivel = 1 / nivel;
  
  // 3. Materias con más créditos tienen mayor peso
  const pesoCreditos = creditos / 4;
  
  // Peso total (puedes ajustar estos factores)
  return (desbloqueos * 2) + (pesoNivel * 3) + (pesoCreditos * 1);
}

function contarDesbloqueos(codigo) {
  return materias.filter(m => 
    m.prerequisitos?.includes(codigo) && 
    !materiasCompletadas.has(obtenerCodigoMateria(m))
  ).length;
}

function generarOpcionInscripcion(materiasOrdenadas) {
  const seleccionadas = [];
  let creditosAcumulados = 0;
  const materiasConsideradas = new Set();
  
  for (const materia of materiasOrdenadas) {
    const codigo = obtenerCodigoMateria(materia);
    
    // Saltar si ya se consideró esta materia o excede los créditos
    if (materiasConsideradas.has(codigo) || 
        creditosAcumulados + materia.creditos > 18) {
      continue;
    }
    
    seleccionadas.push(materia);
    creditosAcumulados += materia.creditos;
    materiasConsideradas.add(codigo);
    
    // Si llegamos cerca al límite, salir
    if (creditosAcumulados >= 15) break;
  }
  
  return seleccionadas;
}

/* -------- Exportar como PDF -------- */
function descargarPDF() {
  const element = document.createElement("div");
  element.className = "pdf-container";
  element.style.padding = "20px";
  
  // Crear contenido para el PDF
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
  
  // Clonar la malla actual
  const mallaClone = document.getElementById("niveles-container").cloneNode(true);
  mallaClone.style.display = "grid";
  mallaClone.style.gridTemplateColumns = "repeat(5, 1fr)";
  mallaClone.style.gap = "10px";
  element.querySelector("#pdf-malla").appendChild(mallaClone);
  
  // Clonar las sugerencias
  const sugerenciasClone = document.getElementById("sugerencias-materias").cloneNode(true);
  element.querySelector("#pdf-sugerencias").appendChild(sugerenciasClone);
  
  // Configurar opciones de PDF
  const opt = {
    margin: 10,
    filename: 'planificacion-mecatronica.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2,
      scrollY: 0,
      logging: true,
      useCORS: true
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait' 
    }
  };
  
  // Generar PDF
  html2pdf().set(opt).from(element).save();
}
