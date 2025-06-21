// Configuração Supabase
const supabaseUrl = 'https://uyfmlcgqbekjtzwnrcui.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5Zm1sY2dxYmVranR6d25yY3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MjMxNjcsImV4cCI6MjA2NjA5OTE2N30.N9mP0ccEQ7hfpitMlOUomB38yLAB_-anMHlqXF0L_7k';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

let usuarioAtual = null;

// Função para entrar (login)
async function entrar() {
  const nome = document.getElementById('nomeUsuario').value.trim();
  const senha = document.getElementById('senhaUsuario').value;

  if (!nome || !senha) {
    alert('Por favor, preencha nome e senha.');
    return;
  }

  const { data: user, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('nome', nome)
    .single();

  if (error) {
    alert('Erro ao buscar usuário: ' + error.message);
    return;
  }

  if (!user) {
    alert('Usuário não encontrado.');
    return;
  }

  if (user.senha !== senha) {
    alert('Senha incorreta!');
    return;
  }

  usuarioAtual = user;

  // Mostrar dashboard e esconder login
  document.getElementById('login').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('nomeSpan').textContent = usuarioAtual.nome;

  // Inicializa filtros e carrega dados
  await inicializarFiltroAno();
  await carregarDados();
}

// Função para sair (logout)
function sair() {
  usuarioAtual = null;
  document.getElementById('login').style.display = 'block';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('nomeUsuario').value = '';
  document.getElementById('senhaUsuario').value = '';
}

// Carregar dados básicos (metas, renda, gastos)
async function carregarDados() {
  if (!usuarioAtual) return;

  // Busca metas do usuário
  let { data: metas, error: errMetas } = await supabase
    .from('metas')
    .select('*')
    .eq('usuario_id', usuarioAtual.id)
    .single();

  if (errMetas) {
    // Se não tem metas, cria padrão
    await supabase.from('metas').insert([{
      usuario_id: usuarioAtual.id,
      fixos: 50,
      gerais: 30,
      lazer: 20
    }]);
    // Buscar novamente
    let metasRes = await supabase
      .from('metas')
      .select('*')
      .eq('usuario_id', usuarioAtual.id)
      .single();
    metas = metasRes.data;
  }

  // Atualiza inputs e resumo metas
  document.getElementById('fixosPct').value = metas.fixos;
  document.getElementById('geraisPct').value = metas.gerais;
  document.getElementById('lazerPct').value = metas.lazer;
  document.getElementById('metasResumo').textContent =
    `Fixos: ${metas.fixos}% | Gerais: ${metas.gerais}% | Lazer: ${metas.lazer}%`;

  // Busca renda atual
  const { data: rendas } = await supabase
    .from('rendas')
    .select('*')
    .eq('usuario_id', usuarioAtual.id)
    .order('criado_em', { ascending: false })
    .limit(1);

  if (rendas && rendas.length > 0) {
    document.getElementById('rendaTotal').textContent = parseFloat(rendas[0].valor).toFixed(2);
  } else {
    document.getElementById('rendaTotal').textContent = "0.00";
  }

  // Atualiza lista gastos e gráfico com mês e ano atual
  const hoje = new Date();
  await atualizarListaGastos(hoje.getMonth() + 1, hoje.getFullYear());
  desenharGrafico();
}

// Função atualizar lista gastos
async function atualizarListaGastos(mes = null, ano = null) {
  if (!usuarioAtual) return;

  const lista = document.getElementById('listaGastos');
  lista.innerHTML = '';

  let query = supabase
    .from('gastos')
    .select('*')
    .eq('usuario_id', usuarioAtual.id);

  if (mes && ano) {
    const inicio = new Date(ano, mes - 1, 1).toISOString();
    const fim = new Date(ano, mes, 1).toISOString();
    query = query.gte('data', inicio).lt('data', fim);
  } else if (ano) {
    const inicioAno = new Date(ano, 0, 1).toISOString();
    const fimAno = new Date(ano + 1, 0, 1).toISOString();
    query = query.gte('data', inicioAno).lt('data', fimAno);
  }

  const { data: gastos, error } = await query.order('data', { ascending: false });

  if (error) {
    alert('Erro ao buscar gastos: ' + error.message);
    return;
  }

  let totalFixos = 0, totalGerais = 0, totalLazer = 0;

  gastos.forEach(gasto => {
    const data = new Date(gasto.data);
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${gasto.descricao || 'Sem descrição'}</strong><br>
      R$ ${parseFloat(gasto.valor).toFixed(2)} - ${gasto.categoria} (${data.toLocaleDateString()})
      <button onclick="editarGasto('${gasto.id}')">✏️</button>
      <button onclick="removerGasto('${gasto.id}')">🗑️</button>
    `;
    lista.appendChild(li);

    if (gasto.categoria === 'fixos') totalFixos += parseFloat(gasto.valor);
    else if (gasto.categoria === 'gerais') totalGerais += parseFloat(gasto.valor);
    else if (gasto.categoria === 'lazer') totalLazer += parseFloat(gasto.valor);
  });

  // Mostra resumo gastos
  lista.innerHTML += `
    <hr>
    <p>Total fixos: R$ ${totalFixos.toFixed(2)}</p>
    <p>Total gerais: R$ ${totalGerais.toFixed(2)}</p>
    <p>Total lazer: R$ ${totalLazer.toFixed(2)}</p>
  `;

  atualizarMetas(totalFixos, totalGerais, totalLazer);
  desenharGrafico();
}

// Adicionar gasto
async function adicionarGasto() {
  if (!usuarioAtual) return;

  const valor = parseFloat(document.getElementById('gastoValor').value);
  const descricao = document.getElementById('gastoDescricao').value.trim();
  const categoria = document.getElementById('gastoCategoria').value;
  const dataInput = document.getElementById('gastoData').value;

  if (isNaN(valor) || valor <= 0) {
    alert("Digite um valor válido.");
    return;
  }

  const data = dataInput ? new Date(dataInput).toISOString() : new Date().toISOString();

  const { error } = await supabase.from('gastos').insert([{
    usuario_id: usuarioAtual.id,
    valor,
    descricao,
    categoria,
    data
  }]);

  if (error) {
    alert("Erro ao adicionar gasto: " + error.message);
    return;
  }

  // Limpar campos
  document.getElementById('gastoValor').value = '';
  document.getElementById('gastoDescricao').value = '';
  document.getElementById('gastoData').value = '';

  // Atualizar lista e gráfico com filtros atuais
  const mes = parseInt(document.getElementById('filtroMes').value) || null;
  const ano = parseInt(document.getElementById('filtroAno').value) || null;

  await atualizarListaGastos(mes, ano);
}

// Remover gasto
async function removerGasto(id) {
  if (!usuarioAtual) return;

  const { error } = await supabase
    .from('gastos')
    .delete()
    .eq('id', id);

  if (error) {
    alert('Erro ao remover gasto: ' + error.message);
    return;
  }

  // Atualizar lista e gráfico
  const mes = parseInt(document.getElementById('filtroMes').value) || null;
  const ano = parseInt(document.getElementById('filtroAno').value) || null;
  await atualizarListaGastos(mes, ano);
}

// Editar gasto (valor)
async function editarGasto(id) {
  if (!usuarioAtual) return;

  const { data: gasto, error } = await supabase
    .from('gastos')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !gasto) {
    alert("Gasto não encontrado.");
    return;
  }

  const novoValorStr = prompt("Novo valor:", gasto.valor);
  if (novoValorStr !== null) {
    const novoValor = parseFloat(novoValorStr);
    if (!isNaN(novoValor) && novoValor > 0) {
      const { error } = await supabase
        .from('gastos')
        .update({ valor: novoValor })
        .eq('id', id);

      if (error) {
        alert("Erro ao atualizar gasto: " + error.message);
        return;
      }

      const mes = parseInt(document.getElementById('filtroMes').value) || null;
      const ano = parseInt(document.getElementById('filtroAno').value) || null;
      await atualizarListaGastos(mes, ano);
    }
  }
}

// Adicionar renda
async function adicionarRenda() {
  if (!usuarioAtual) return;

  const valorStr = prompt("Digite o valor da nova renda:");
  if (!valorStr) return;

  const valor = parseFloat(valorStr);
  if (isNaN(valor) || valor <= 0) {
    alert("Digite um valor válido.");
    return;
  }

  const { error } = await supabase.from('rendas').insert([{
    usuario_id: usuarioAtual.id,
    valor
  }]);

  if (error) {
    alert("Erro ao adicionar renda: " + error.message);
    return;
  }

  document.getElementById('rendaTotal').textContent = valor.toFixed(2);
  desenharGrafico();
  await atualizarListaGastos();
}

// Salvar metas
async function salvarMetas() {
  if (!usuarioAtual) return;

  const fixos = parseInt(document.getElementById('fixosPct').value);
  const gerais = parseInt(document.getElementById('geraisPct').value);
  const lazer = parseInt(document.getElementById('lazerPct').value);

  if (fixos + gerais + lazer !== 100) {
    alert("A soma dos percentuais deve ser exatamente 100%");
    return;
  }

  const { error } = await supabase
    .from('metas')
    .update({ fixos, gerais, lazer })
    .eq('usuario_id', usuarioAtual.id);

  if (error) {
    alert("Erro ao salvar metas: " + error.message);
    return;
  }

  document.getElementById('metasResumo').textContent =
    `Fixos: ${fixos}% | Gerais: ${gerais}% | Lazer: ${lazer}%`;

  desenharGrafico();
}

// Atualizar barras de metas
function atualizarMetas(totalFixos = 0, totalGerais = 0, totalLazer = 0) {
  if (!usuarioAtual) return;

  const fixos = parseInt(document.getElementById('fixosPct').value);
  const gerais = parseInt(document.getElementById('geraisPct').value);
  const lazer = parseInt(document.getElementById('lazerPct').value);

  const rendaTotal = parseFloat(document.getElementById('rendaTotal').textContent);

  function gerarBarra(categoria, gasto, meta) {
    let percentual = meta === 0 ? 0 : Math.min((gasto / meta) * 100, 100);
    let cor = '#28a745'; // verde
    if (percentual > 90) cor = '#dc3545'; // vermelho
    else if (percentual > 70) cor = '#ffc107'; // amarelo

    return `
      <p>${categoria}: R$ ${gasto.toFixed(2)} / Meta R$ ${(rendaTotal * meta / 100).toFixed(2)}</p>
      <div style="background:#eee; width: 100%; height: 15px; border-radius: 5px;">
        <div style="width: ${percentual}%; background: ${cor}; height: 15px; border-radius: 5px;"></div>
      </div>
    `;
  }

  document.getElementById('metasDisplay').innerHTML =
    gerarBarra('Fixos', totalFixos, fixos) +
    gerarBarra('Gerais', totalGerais, gerais) +
    gerarBarra('Lazer', totalLazer, lazer);
}

// Editar metas - mostrar inputs e botão confirmar
function editarMetas() {
  const linha = document.getElementById('metasLinha');
  linha.style.display = linha.style.display === 'flex' ? 'none' : 'flex';
}

// Filtro ano - preenche options com últimos anos
async function inicializarFiltroAno() {
  const selectAno = document.getElementById('filtroAno');
  const anoAtual = new Date().getFullYear();

  selectAno.innerHTML = '<option value="">Todos</option>';
  for (let ano = anoAtual; ano >= anoAtual - 10; ano--) {
    const opt = document.createElement('option');
    opt.value = ano;
    opt.textContent = ano;
    selectAno.appendChild(opt);
  }
}

// Filtrar lista por mês e ano selecionados
async function filtrarPorData() {
  const mes = parseInt(document.getElementById('filtroMes').value) || null;
  const ano = parseInt(document.getElementById('filtroAno').value) || null;
  await atualizarListaGastos(mes, ano);
}

// Desenhar gráfico com Chart.js
let grafico = null;
async function desenharGrafico() {
  if (!usuarioAtual) return;

  // Busca gastos atuais no filtro
  const mes = parseInt(document.getElementById('filtroMes').value) || (new Date().getMonth() + 1);
  const ano = parseInt(document.getElementById('filtroAno').value) || (new Date().getFullYear());

  const { data: gastos, error } = await supabase
    .from('gastos')
    .select('*')
    .eq('usuario_id', usuarioAtual.id)
    .gte('data', new Date(ano, mes - 1, 1).toISOString())
    .lt('data', new Date(ano, mes, 1).toISOString());

  if (error) {
    alert('Erro ao buscar gastos para gráfico: ' + error.message);
    return;
  }

  // Soma por categoria
  const soma = { fixos: 0, gerais: 0, lazer: 0 };
  gastos.forEach(g => {
    soma[g.categoria] += parseFloat(g.valor);
  });

  const ctx = document.getElementById('graficoGastos').getContext('2d');

  if (grafico) {
    grafico.destroy();
  }

  grafico = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Fixos', 'Gerais', 'Lazer'],
      datasets: [{
        label: 'Gastos por categoria',
        data: [soma.fixos, soma.gerais, soma.lazer],
        backgroundColor: ['#007bff', '#ffc107', '#28a745']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}
