/*
 * NextFluent — autenticação de alunos (cadastro/login) via Supabase
 * (Auth + banco Postgres), carregado como script clássico (o pacote
 * @supabase/supabase-js publica um build pronto pra <script src="">,
 * sem bundler nem "type=module"), pra continuar funcionando igual ao
 * resto do site.
 *
 * Depende de:
 *   - https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2 (carregado
 *     antes deste arquivo — define window.supabase.createClient)
 *   - assets/supabase-config.js (window.NEXTFLUENT_SUPABASE_CONFIG e
 *     window.NEXTFLUENT_ADMIN_EMAILS), carregado antes deste arquivo
 *
 * Se o Supabase ainda não foi configurado (url/anonKey ainda são
 * "REPLACE_ME"), tudo aqui vira um "modo desligado": isConfigured()
 * retorna false, e o resto do site (progress.js) volta a funcionar só
 * com localStorage, como sempre funcionou — nada quebra enquanto o
 * dono do curso não configurar o Supabase (ver assets/supabase-config.js).
 *
 * Este arquivo é o ÚNICO lugar do site que sabe o "formato" do
 * backend (linhas do Postgres, sessão do Supabase etc.) — todo o
 * resto (progress.js, cadastro.html, login.html, admin.html) só
 * conversa com o objeto window.NFAuth abaixo, sempre com o mesmo
 * formato (uid/email/displayName, getStudentRecord, etc.). Trocar de
 * backend de novo no futuro só deve exigir mexer aqui.
 */
(function (window) {
  "use strict";

  var config = window.NEXTFLUENT_SUPABASE_CONFIG || {};
  var configured =
    !!config.url &&
    config.url !== "REPLACE_ME" &&
    !!config.anonKey &&
    config.anonKey !== "REPLACE_ME" &&
    typeof window.supabase !== "undefined";

  var client = null;
  var currentUser = null;
  var ready = false;
  var readyCallbacks = [];

  function normalizeUser(supaUser) {
    if (!supaUser) return null;
    var meta = supaUser.user_metadata || {};
    return {
      uid: supaUser.id,
      email: supaUser.email,
      displayName: (meta.full_name || "").trim(),
      updateProfile: function (patch) {
        return client.auth
          .updateUser({ data: { full_name: patch.displayName } })
          .then(function (res) {
            if (res.error) throw res.error;
          });
      },
    };
  }

  if (configured) {
    try {
      client = window.supabase.createClient(config.url, config.anonKey);
      client.auth.onAuthStateChange(function (_event, session) {
        currentUser = normalizeUser(session && session.user);
        ready = true;
        readyCallbacks.forEach(function (cb) {
          cb(currentUser);
        });
        document.dispatchEvent(new CustomEvent("nextfluent:auth-changed", { detail: { user: currentUser } }));
      });
    } catch (err) {
      configured = false;
      /* eslint-disable-next-line no-console */
      console.error("NextFluent: falha ao iniciar o Supabase.", err);
    }
  }

  function isConfigured() {
    return configured;
  }

  function getCurrentUser() {
    return currentUser;
  }

  /** Chama cb(user) assim que o estado de login for conhecido pela
   * primeira vez, e de novo toda vez que ele mudar (login/logout). */
  function onChange(cb) {
    if (!configured) {
      cb(null);
      return;
    }
    if (ready) cb(currentUser);
    readyCallbacks.push(cb);
  }

  function isAdmin(user) {
    user = user || currentUser;
    if (!user || !user.email) return false;
    var admins = window.NEXTFLUENT_ADMIN_EMAILS || [];
    var email = user.email.toLowerCase();
    return admins.some(function (a) { return (a || "").toLowerCase() === email; });
  }

  function friendlyError(err) {
    var msg = (err && err.message) || "";
    if (/already registered|already exists/i.test(msg)) {
      return "Esse e-mail já tem uma conta. Tente entrar em vez de cadastrar.";
    }
    if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
    if (/password.*(least|6|characters)/i.test(msg)) return "A senha precisa ter pelo menos 6 caracteres.";
    if (/rate limit/i.test(msg)) return "Muitas tentativas. Espere um pouco e tente de novo.";
    if (/invalid email/i.test(msg)) return "Digite um e-mail válido.";
    if (/network|fetch/i.test(msg)) return "Falha de conexão. Verifique sua internet e tente de novo.";
    return msg || "Não foi possível completar a ação. Tente novamente.";
  }

  // --- linha da tabela "students" (o "perfil" de cada aluno) --------------

  function rowToRecord(row) {
    if (!row) return null;
    return {
      name: row.name || "",
      email: row.email || "",
      phone: row.phone || "",
      completedLessons: row.completed_lessons || {},
      completedCount: row.completed_count || 0,
      totalLessons: row.total_lessons || 0,
      certificateDate: row.certificate_date || null,
      createdAt: row.created_at || null,
      lastActive: row.last_active || null,
    };
  }

  function recordToRow(uid, patch) {
    var row = { id: uid };
    if ("name" in patch) row.name = patch.name;
    if ("email" in patch) row.email = patch.email;
    if ("phone" in patch) row.phone = patch.phone;
    if ("completedLessons" in patch) row.completed_lessons = patch.completedLessons;
    if ("completedCount" in patch) row.completed_count = patch.completedCount;
    if ("totalLessons" in patch) row.total_lessons = patch.totalLessons;
    if ("certificateDate" in patch) row.certificate_date = patch.certificateDate;
    if ("createdAt" in patch) row.created_at = patch.createdAt;
    row.last_active = new Date().toISOString();
    return row;
  }

  /** Busca o cadastro (linha da tabela students) do aluno logado. */
  function getStudentRecord(uid) {
    if (!configured) return Promise.resolve(null);
    return client
      .from("students")
      .select("*")
      .eq("id", uid)
      .maybeSingle()
      .then(function (res) {
        if (res.error) throw res.error;
        return rowToRecord(res.data);
      });
  }

  /** Cria/atualiza (merge) o cadastro do aluno logado. */
  function upsertStudentRecord(uid, patch) {
    if (!configured) return Promise.resolve();
    return client
      .from("students")
      .upsert(recordToRow(uid, patch))
      .then(function (res) {
        if (res.error) throw res.error;
      });
  }

  /** Lista todos os cadastros — só retorna algo pra quem passa nas
   * regras de admin (ver supabase-schema.sql); pra qualquer outro
   * aluno, o Postgres simplesmente devolve só a própria linha (ou
   * nenhuma, se ele não tiver uma). */
  function listAllStudents() {
    if (!configured) return Promise.resolve([]);
    return client
      .from("students")
      .select("*")
      .then(function (res) {
        if (res.error) throw res.error;
        return (res.data || []).map(rowToRecord);
      });
  }

  // --- cadastro / login / logout ------------------------------------------

  function signUp(name, email, password, phone) {
    if (!configured) return Promise.reject(new Error("Cadastro ainda não configurado."));
    name = (name || "").trim();
    phone = (phone || "").trim();
    return client.auth
      .signUp({ email: email, password: password, options: { data: { full_name: name, phone: phone } } })
      .then(function (res) {
        if (res.error) throw res.error;
        var session = res.data && res.data.session;
        var supaUser = res.data && res.data.user;
        if (!session || !supaUser) {
          var err = new Error(
            "Conta criada! Confira seu e-mail (" + email + ") e clique no link de confirmação para poder entrar."
          );
          err.code = "email-confirmation-required";
          throw err;
        }
        var localProgress = {};
        try {
          localProgress = JSON.parse(window.localStorage.getItem("nextfluent_progress_v1") || "{}");
        } catch (e) {
          localProgress = {};
        }
        var total = Array.isArray(window.NEXTFLUENT_LESSONS) ? window.NEXTFLUENT_LESSONS.length : 0;
        var done = Object.keys(localProgress).filter(function (k) { return localProgress[k] === true; }).length;
        return upsertStudentRecord(supaUser.id, {
          name: name,
          email: supaUser.email,
          phone: phone,
          completedLessons: localProgress,
          completedCount: done,
          totalLessons: total,
          certificateDate: null,
          createdAt: new Date().toISOString(),
        }).then(function () {
          return normalizeUser(supaUser);
        });
      })
      .catch(function (err) {
        if (err && err.code === "email-confirmation-required") throw err;
        throw new Error(friendlyError(err));
      });
  }

  function signIn(email, password) {
    if (!configured) return Promise.reject(new Error("Login ainda não configurado."));
    return client.auth
      .signInWithPassword({ email: email, password: password })
      .then(function (res) {
        if (res.error) throw res.error;
        return normalizeUser(res.data.user);
      })
      .catch(function (err) {
        throw new Error(friendlyError(err));
      });
  }

  function signOutUser() {
    if (!configured) return Promise.resolve();
    return client.auth.signOut();
  }

  function resetPassword(email) {
    if (!configured) return Promise.reject(new Error("Recurso ainda não configurado."));
    return client.auth.resetPasswordForEmail(email).then(function (res) {
      if (res.error) throw new Error(friendlyError(res.error));
    });
  }

  // --- barra superior: mostra "Entrar" ou "Olá, Nome · Sair" ------------

  function firstName(user) {
    var name = (user.displayName || "").trim();
    if (!name) return user.email;
    return name.split(" ")[0];
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderAuthSlot() {
    var slot = document.getElementById("nf-auth-slot");
    if (!slot) return;

    if (!configured) {
      // cadastro ainda não configurado (assets/supabase-config.js): mostra
      // os links normalmente. Ao clicar, cadastro.html/login.html exibem
      // um aviso explicando que a área de conta está sendo configurada.
      var root0 = slot.getAttribute("data-root") || "";
      slot.innerHTML =
        '<a href="' + root0 + 'login.html">Entrar</a><a href="' + root0 + 'cadastro.html">Criar conta</a>';
      return;
    }

    onChange(function (user) {
      var root = slot.getAttribute("data-root") || "";
      if (user) {
        var adminLink = isAdmin(user) ? '<a href="' + root + 'admin.html">Alunos</a>' : "";
        slot.innerHTML =
          '<span class="auth-name">Olá, ' +
          escapeHtml(firstName(user)) +
          "</span>" +
          adminLink +
          '<button type="button" id="nf-logout-btn">Sair</button>';
        var btn = document.getElementById("nf-logout-btn");
        if (btn) {
          btn.addEventListener("click", function () {
            signOutUser().then(function () {
              window.location.href = root + "index.html";
            });
          });
        }
      } else {
        slot.innerHTML =
          '<a href="' + root + 'login.html">Entrar</a><a href="' + root + 'cadastro.html">Criar conta</a>';
      }
    });
  }

  window.NFAuth = {
    isConfigured: isConfigured,
    getCurrentUser: getCurrentUser,
    onChange: onChange,
    isAdmin: isAdmin,
    signUp: signUp,
    signIn: signIn,
    signOutUser: signOutUser,
    resetPassword: resetPassword,
    getStudentRecord: getStudentRecord,
    upsertStudentRecord: upsertStudentRecord,
    listAllStudents: listAllStudents,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderAuthSlot);
  } else {
    renderAuthSlot();
  }
})(window);
