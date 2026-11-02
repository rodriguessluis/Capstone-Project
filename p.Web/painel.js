// Painel do Semáforo Inteligente: pede /api/estado a cada 2 s e atualiza a página.
const VIAS = ["N", "S", "E", "O"];
const MODOS = { ADAPTATIVO: "Adaptativo", CICLO_FIXO: "Ciclo fixo", AMARELO_INTERMITENTE: "Amarelo intermitente" };
const ESTADOS = { VERDE: "Verde", AMARELO: "Amarelo", VERMELHO: "Vermelho" };
const $ = (id) => document.getElementById(id);
const num = (n) => (n == null ? "—" : n.toLocaleString("pt-PT"));

Chart.defaults.color = "#94A3B8";
Chart.defaults.borderColor = "#334155";

const gEspera = new Chart($("g-espera"), {
  type: "line",
  data: {
    labels: [],
    datasets: [
      { label: "Adaptativo", data: [], borderColor: "#38BDF8", backgroundColor: "#38BDF8", tension: 0.25 },
      { label: "Ciclo fixo", data: [], borderColor: "#FBBF24", backgroundColor: "#FBBF24", borderDash: [8, 5], tension: 0.25 },
    ],
  },
  options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true } } },
});

const gFluxo = new Chart($("g-fluxo"), {
  type: "bar",
  data: { labels: [], datasets: [{ label: "Veículos", data: [], backgroundColor: [], borderRadius: 4 }] },
  options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
});

function pintarLuzes(via, estado) {
  $(`luz-${via}-r`).setAttribute("fill", estado === "VERMELHO" ? "#F87171" : "#4A2323");
  $(`luz-${via}-a`).setAttribute("fill", estado === "AMARELO" ? "#FBBF24" : "#4A3F17");
  $(`luz-${via}-v`).setAttribute("fill", estado === "VERDE" ? "#4ADE80" : "#14532D");
}

function celula(texto, classe) {
  const td = document.createElement("td");
  if (classe) {
    const span = document.createElement("span");
    span.className = classe;
    span.textContent = texto;
    td.appendChild(span);
  } else {
    td.textContent = texto;
  }
  return td;
}

function desenharAlertas(alertas) {
  const corpo = $("alertas");
  corpo.replaceChildren();
  if (!alertas.length) {
    const tr = document.createElement("tr");
    const td = celula("Sem falhas registadas.");
    td.colSpan = 4;
    tr.appendChild(td);
    corpo.appendChild(tr);
    return;
  }
  for (const a of alertas) {
    const tr = document.createElement("tr");
    const resolvido = a.estado === "Resolvido";
    tr.append(celula(a.ts), celula(a.tipo), celula(a.detalhe), celula(resolvido ? "Resolvido" : "Aviso ativo", "tag " + (resolvido ? "ok" : "aviso")));
    corpo.appendChild(tr);
  }
}

function desenhar(d) {
  $("chip-modo").textContent = "Modo: " + (MODOS[d.modo] || d.modo);
  $("chip-fonte").textContent = d.fonte === "real" ? "Dados reais do ESP32" : "Dados de demonstração";
  $("rodape").hidden = d.fonte === "real";

  $("k-veiculos").textContent = num(d.kpis.veiculos_hoje);
  $("k-espera").textContent = d.kpis.espera_media == null ? "—" : d.kpis.espera_media + " s";
  $("k-fila").textContent = num(d.kpis.fila_maxima);
  $("k-ciclos").textContent = num(d.kpis.ciclos);

  for (const v of VIAS) {
    const estado = d.luzes[v];
    pintarLuzes(v, estado);
    $(`est-${v}`).textContent = ESTADOS[estado];
    $(`est-${v}`).style.color = { VERDE: "#4ADE80", AMARELO: "#FBBF24", VERMELHO: "#F87171" }[estado];
    $(`info-${v}`).textContent = estado === "VERMELHO" ? "A aguardar a vez" : `${d.restante} s restantes`;
    const n = d.fila[v];
    $(`fila-${v}`).textContent = `${n} ${n === 1 ? "veículo" : "veículos"} na fila`;
  }

  const total = Object.values(d.hoje).reduce((a, b) => a + b, 0) || 1;
  for (const v of VIAS) {
    const pct = Math.round((100 * d.hoje[v]) / total);
    $(`pct-${v}`).textContent = pct + "%";
    $(`barra-${v}`).style.width = pct + "%";
  }

  const h = d.historico;
  gEspera.data.labels = h.horas;
  gEspera.data.datasets[0].data = h.espera_adaptativo;
  gEspera.data.datasets[1].data = h.espera_fixo;
  gEspera.update("none");

  const topo = [...h.fluxo].sort((a, b) => b - a).slice(0, 2);          // destaca os 2 picos
  gFluxo.data.labels = h.horas;
  gFluxo.data.datasets[0].data = h.fluxo;
  gFluxo.data.datasets[0].backgroundColor = h.fluxo.map((x) => (topo.includes(x) && x > 0 ? "#38BDF8" : "#1E6FA8"));
  gFluxo.update("none");

  desenharAlertas(d.alertas);
}

async function atualizar() {
  try {
    const resposta = await fetch("/api/estado", { cache: "no-store" });
    desenhar(await resposta.json());
    $("atualizado").textContent = "atualizado às " + new Date().toLocaleTimeString("pt-PT");
  } catch (erro) {
    $("atualizado").textContent = "sem ligação ao servidor";
    $("chip-fonte").textContent = "Sem ligação";
    $("chip-fonte").className = "chip erro";
    return;
  }
  $("chip-fonte").className = "chip ok";
}

atualizar();
setInterval(atualizar, 2000);
