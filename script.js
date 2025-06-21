// Supabase - substitua com seus dados reais
const supabaseUrl = 'https://uyfmlcgqbekjtzwnrcui.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5Zm1sY2dxYmVranR6d25yY3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MjMxNjcsImV4cCI6MjA2NjA5OTE2N30.N9mP0ccEQ7hfpitMlOUomB38yLAB_-anMHlqXF0L_7k';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

let usuarioAtual = null; // vai guardar info do usuário logado

// ----- FUNÇÃO DE LOGIN SIMPLES (com nome e senha, pra depois melhorar)

// Tenta logar o usuário, ou criar se não existir (básico, sem segurança ainda)
// ----- NOVA FUNÇÃO DE LOGIN COM AUTENTICAÇÃO E APROVAÇÃO
async function entrar() {
  const email = document.getElementById('emailUsuario').value.trim();
  const senha = document.getElementById('senhaUsuario').value.trim();

  if (!email || !senha) {
    alert("Digite seu e-mail e senha.");
    return;
  }

  // Autenticar usando Supabase Auth
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password: senha
  });

  if (loginError) {
    alert("E-mail ou senha inválidos.");
    return;
  }

  // Buscar dados extras na tabela usuarios (ver se foi aprovado)
  const { data: userInfo, error: userError } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .single();

  if (userError || !userInfo) {
    alert("Erro ao verificar aprovação do usuário.");
    return;
  }

  if (!userInfo.aprovado) {
    alert("Seu acesso ainda não foi aprovado pelo administrador.");
    await supabase.auth.signOut();
    return;
  }

  usuarioAtual = userInfo;

  // Sucesso no login:
  document.getElementById('login').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('nomeSpan').textContent = usuarioAtual.nome || usuarioAtual.email;

  await carregarDados();
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  await atualizarListaGastos(mesAtual, anoAtual);
  desenharGrafico();
}

  if (error && error.code === 'PGRST116') {
    // usuário não existe, cria
    const { data: novoUser, error: errInsert } = await supabase
      .from('usuarios')
      .insert([{ nome, senha }])
      .select()
      .single();

    if (errInsert) {
      alert('Erro ao criar usuário: ' + errInsert.message);
      return;
    }
    usuarioAtual = novoUser;
  } else if (error) {
    alert('Erro: ' + error.message);
    return;
  } else {
    // usuário existe, verifica senha
    if (user.senha !== senha) {
      alert('Senha incorreta!');
      return;
    }
    usuarioAtual = user;
  }

  // Sucesso no login:
  document.getElementById('login').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('nomeSpan').textContent = usuarioAtual.nome;

  await carregarDados();
}

// ------ FUNÇÃO LOGOUT

function sair() {
  usuarioAtual = null;
  document.getElementById('login').style.display = 'block';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('nomeUsuario').value = '';
}

// ------ CARREGAR DADOS: metas, renda, gastos

async function carregarDados() {
  if (!usuarioAtual) return;

  // metas
  const { data: metas, error: errMetas } = await supabase
    .from('metas')
    .select('*')
    .eq('usuario_id', usuarioAtual.id)
    .single();

  if (errMetas) {
    console.log("Usuário sem metas, criando padrão...");
    await supabase.from('metas').insert([{
      usuario_id: usuarioAtual.id,
      fixos: 50,
      gerais: 30,
      lazer: 20
    }]);
  }

  // pega metas de novo
  const { data: metasAtualizadas } = await supabase
    .from('metas')
    .select('*')
    .eq('usuario_id', usuarioAtual.id)
    .single();

  // atualiza inputs e resumo
  document.getElementById('fixosPct').value = metasAtualizadas.fixos;
  document.getElementById('geraisPct').value = metasAtualizadas.gerais;
  document.getElementById('lazerPct').value = metasAtualizadas.lazer;

  document.getElementById('metasResumo').textContent =
    `Fixos: ${metasAtualizadas.fixos}% | Gerais: ${metasAtualizadas.gerais}% | Lazer: ${metasAtualizadas.lazer}%`;

  // renda (pega a renda mais recente)
  const { data: rendas, error: errRendas } = await supabase
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

  // gastos (carregar lista com filtro inicial: mês/ano atual)
  const dataAtual = new Date();
  const mesAtual = dataAtual.getMonth() + 1;
  const anoAtual = dataAtual.getFullYear();

  await atualizarListaGastos(mesAtual, anoAtual);

  desenharGrafico();
}

// ------ ATUALIZAR LISTA DE GASTOS

async function atualizarListaGastos(filtroMes = null, filtroAno = null) {
  if (!usuarioAtual) return;

  const lista = document.getElementById('listaGastos');
  lista.innerHTML = '';

  let query = supabase
    .from('gastos')
    .select('*')
    .eq('usuario_id', usuarioAtual.id);

  if (filtroMes) {
    // Filtra o mês (1 a 12) no campo data
    const inicio = new Date(filtroAno, filtroMes - 1, 1).toISOString();
    const fim = new Date(filtroAno, filtroMes, 1).toISOString();

    query = query.gte('data', inicio).lt('data', fim);
  } else if (filtroAno) {
    // Filtra só ano
    const inicioAno = new Date(filtroAno, 0, 1).toISOString();
    const fimAno = new Date(filtroAno + 1, 0, 1).toISOString();

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

  // Mostrar resumo abaixo
  lista.innerHTML += `
    <hr>
    <p>Total fixos: R$ ${totalFixos.toFixed(2)}</p>
    <p>Total gerais: R$ ${totalGerais.toFixed(2)}</p>
    <p>Total lazer: R$ ${totalLazer.toFixed(2)}</p>
  `;

  atualizarMetas(totalFixos, totalGerais, totalLazer);
  desenharGrafico();
}

// ------ ADICIONAR GASTO

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

  // Limpa campos
  document.getElementById('gastoValor').value = '';
  document.getElementById('gastoDescricao').value = '';
  document.getElementById('gastoData').value = '';

  // Atualiza lista e gráfico
  const mes = document.getElementById('filtroMes').value || null;
  const ano = document.getElementById('filtroAno').value || null;

  await atualizarListaGastos(mes ? parseInt(mes) : null, ano ? parseInt(ano) : null);
}

// ------ REMOVER GASTO

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

  // Atualiza lista e gráfico
  const mes = document.getElementById('filtroMes').value || null;
  const ano = document.getElementById('filtroAno').value || null;

  await atualizarListaGastos(mes ? parseInt(mes) : null, ano ? parseInt(ano) : null);
}

// ------ EDITAR GASTO

async function editarGasto(id) {
  if (!usuarioAtual) return;

  let gastos = await supabase
    .from('gastos')
    .select('*')
    .eq('id', id)
    .single();

  if (!gastos.data) {
    alert("Gasto não encontrado.");
    return;
  }

  const gasto = gastos.data;
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
      // Atualiza lista e gráfico
      const mes = document.getElementById('filtroMes').value || null;
      const ano = document.getElementById('filtroAno').value || null;

      await atualizarListaGastos(mes ? parseInt(mes) : null, ano ? parseInt(ano) : null);
    }
  }
}

// ------ ADICIONAR RENDA

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

// ------ SALVAR METAS

async function salvarMetas() {
  if (!usuarioAtual) return;

  const fixos = parseInt(document.getElementById('fixosPct').value);
  const gerais = parseInt(document.getElementById('geraisPct').value);
  const lazer = parseInt(document.getElementById('lazerPct').value);

  if (fixos + gerais + lazer !== 100) {
    alert("A soma dos percentuais deve ser exatamente 100%");
    return;
  }

  // Atualiza as metas (assumindo que já existe)
  const { data, error } = await supabase
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

// ------ ATUALIZAR BARRAS DE PROGRESSO DAS METAS

function atualizarMetas(totalFixos = 0, totalGerais = 0, totalLazer = 0) {
  if (!usuarioAtual) return;

  const fixos = parseInt(document.getElementById('fixosPct').value);
  const gerais = parseInt(document.getElementById('geraisPct').value);
  const lazer = parseInt(document.getElementById('lazerPct').value);

  // Busca a renda atual (mostra última)
  const rendaTotal = parseFloat(document.getElementById('rendaTotal').textContent);

  function gerarBarra(categoria, gasto, meta) {
    let percentual = (meta === 0) ? 0 : Math.min((gasto / meta) * 100, 100);
    let cor = '#28a745'; // verde
    if (percentual > 90) cor = '#dc3545'; // vermelho
    else if (percentual > 70) cor = '#ffc107'; // amarelo

    return `
      <p>${categoria}: R$ ${gasto.toFixed(2)} / R$ ${meta.toFixed(2)}</p>
      <div class="barra-externa">
        <div class="barra-interna" style="width: ${percentual}%; background-color: ${cor};">
          ${percentual.toFixed(0)}%
        </div>
      </div>
    `;
  }

  const fixosMeta = (rendaTotal * fixos) / 100;
  const geraisMeta = (rendaTotal * gerais) / 100;
  const lazerMeta = (rendaTotal * lazer) / 100;

  const html = `
    ${gerarBarra('Fixos', totalFixos, fixosMeta)}
    ${gerarBarra('Gerais', totalGerais, geraisMeta)}
    ${gerarBarra('Lazer', totalLazer, lazerMeta)}
  `;

  document.getElementById('metasDisplay').innerHTML = html;
}

// ------ DESENHAR GRÁFICO (usando Chart.js)

let chartInstance = null;

function desenharGrafico() {
  if (!usuarioAtual) return;

  const fixos = parseFloat(document.getElementById('fixosPct').value) || 0;
  const gerais = parseFloat(document.getElementById('geraisPct').value) || 0;
  const lazer = parseFloat(document.getElementById('lazerPct').value) || 0;

  const rendaTotal = parseFloat(document.getElementById('rendaTotal').textContent) || 0;

  const fixosMeta = (rendaTotal * fixos) / 100;
  const geraisMeta = (rendaTotal * gerais) / 100;
  const lazerMeta = (rendaTotal * lazer) / 100;

  // Pega os gastos atuais do resumo na tela
  const fixosGastos = document.querySelector('#metasDisplay p:nth-child(1)');
  const geraisGastos = document.querySelector('#metasDisplay p:nth-child(2)');
  const lazerGastos = document.querySelector('#metasDisplay p:nth-child(3)');

  let gastosFixos = 0, gastosGerais = 0, gastosLazer = 0;

  if (fixosGastos) gastosFixos = parseFloat(fixosGastos.textContent.match(/R\$ ([\d\.]+)/)[1].replace('.', '').replace(',', '.'));
  if (geraisGastos) gastosGerais = parseFloat(geraisGastos.textContent.match(/R\$ ([\d\.]+)/)[1].replace('.', '').replace(',', '.'));
  if (lazerGastos) gastosLazer = parseFloat(lazerGastos.textContent.match(/R\$ ([\d\.]+)/)[1].replace('.', '').replace(',', '.'));

  // Atualiza gráfico com dados reais
  const ctx = document.getElementById('graficoGastos').getContext('2d');

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Fixos', 'Gerais', 'Lazer'],
      datasets: [{
        label: 'Gastos por Categoria',
        data: [gastosFixos, gastosGerais, gastosLazer],
        backgroundColor: [
          '#007bff',
          '#ffc107',
          '#28a745'
        ],
        borderWidth: 1
      }]
    }
  });
}

// ------ FILTRAR POR DATA

document.getElementById('filtroMes').addEventListener('change', async () => {
  const mes = parseInt(document.getElementById('filtroMes').value) || null;
  const ano = parseInt(document.getElementById('filtroAno').value) || null;
  await atualizarListaGastos(mes, ano);
});

document.getElementById('filtroAno').addEventListener('change', async () => {
  const mes = parseInt(document.getElementById('filtroMes').value) || null;
  const ano = parseInt(document.getElementById('filtroAno').value) || null;
  await atualizarListaGastos(mes, ano);
});

// ------ INICIALIZAR FILTRO DE ANOS DINAMICAMENTE

async function inicializarFiltroAno() {
  if (!usuarioAtual) return;
  const selectAno = document.getElementById('filtroAno');
  selectAno.innerHTML = '';

  // Pega anos distintos dos gastos do usuário
  const { data: anos, error } = await supabase
    .from('gastos')
    .select("EXTRACT(year FROM data) as ano")
    .eq('usuario_id', usuarioAtual.id)
    .order('ano', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  // Criar lista única de anos
  const anosUnicos = [...new Set(anos.map(a => Math.floor(a.ano)))];

  anosUnicos.forEach(ano => {
    const option = document.createElement('option');
    option.value = ano;
    option.textContent = ano;
    selectAno.appendChild(option);
  });

  // Seleciona ano atual por padrão
  const anoAtual = new Date().getFullYear();
  selectAno.value = anoAtual;
}

