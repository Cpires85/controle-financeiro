// ✅ Primeiro: crie o cliente Supabase
const supabaseUrl = 'https://uyfmlcgqbekjtzwnrcui.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5Zm1sY2dxYmVranR6d25yY3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MjMxNjcsImV4cCI6MjA2NjA5OTE2N30.N9mP0ccEQ7hfpitMlOUomB38yLAB_-anMHlqXF0L_7k'; // chave truncada por segurança
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Só depois comece a usar o supabase:
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
}

function sair() {
  usuarioAtual = null;
  document.getElementById('login').style.display = 'block';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('emailUsuario').value = '';
  document.getElementById('senhaUsuario').value = '';
}
