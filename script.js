const supabaseUrl = 'https://uyfmlcgqbekjtzwnrcui.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // truncado para segurança
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

let usuarioAtual = null;

async function entrar() {
  const email = document.getElementById('emailUsuario').value.trim();
  const senha = document.getElementById('senhaUsuario').value.trim();

  if (!email || !senha) {
    alert('Preencha e-mail e senha!');
    return;
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .eq('senha', senha)
    .single();

  if (error || !data) {
    alert('Login inválido ou usuário não autorizado!');
    return;
  }

  usuarioAtual = data;
  document.getElementById('login').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('nomeSpan').textContent = usuarioAtual.nome;
  // Aqui você pode chamar carregarDados() se tiver
}

function sair() {
  usuarioAtual = null;
  document.getElementById('login').style.display = 'block';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('emailUsuario').value = '';
  document.getElementById('senhaUsuario').value = '';
}
