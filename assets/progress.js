/*
 * NextFluent — progresso do curso (aulas concluídas + certificado).
 *
 * O progresso sempre é salvo com localStorage primeiro (rápido, some
 * mesmo sem internet) — esse continua sendo o comportamento padrão do
 * curso, 100% local. Se a área de cadastro estiver configurada (ver
 * assets/supabase-config.js) e o aluno estiver logado, o progresso
 * TAMBÉM é sincronizado com a nuvem (Supabase), pra funcionar em mais
 * de um aparelho e aparecer no painel do admin (admin.html). Sem login
 * (ou com o cadastro ainda não configurado), tudo funciona exatamente
 * como sempre funcionou, só no navegador do aluno.
 *
 * Depende de window.NEXTFLUENT_LESSONS, gerado por scripts/build_html.py
 * em assets/lessons-data.js (precisa ser carregado ANTES deste arquivo),
 * e opcionalmente de window.NFAuth (assets/auth.js + assets/supabase-config.js,
 * também carregados antes).
 */
(function (window) {
  "use strict";

  var PROGRESS_KEY = "nextfluent_progress_v1";
  var NAME_KEY = "nextfluent_student_name";
  var DATE_KEY = "nextfluent_completion_date";

  function storageAvailable() {
    try {
      var testKey = "__nf_test__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return true;
    } catch (err) {
      return false;
    }
  }

  var hasStorage = storageAvailable();

  function readJSON(key, fallback) {
    if (!hasStorage) return fallback;
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    if (!hasStorage) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* localStorage indisponível (modo privado, quota cheia etc.) — ignora */
    }
  }

  function readString(key) {
    if (!hasStorage) return "";
    try {
      return window.localStorage.getItem(key) || "";
    } catch (err) {
      return "";
    }
  }

  function writeString(key, value) {
    if (!hasStorage) return;
    try {
      window.localStorage.setItem(key, value);
    } catch (err) {
      /* ignora */
    }
  }

  function getLessons() {
    return Array.isArray(window.NEXTFLUENT_LESSONS) ? window.NEXTFLUENT_LESSONS : [];
  }

  function getProgress() {
    return readJSON(PROGRESS_KEY, {});
  }

  function isDone(lessonId) {
    return getProgress()[lessonId] === true;
  }

  function countDone(progress, lessons) {
    var n = 0;
    for (var i = 0; i < lessons.length; i++) {
      if (progress[lessons[i].id] === true) n++;
    }
    return n;
  }

  function completedCount() {
    return countDone(getProgress(), getLessons());
  }

  function totalCount() {
    return getLessons().length;
  }

  function percent() {
    var total = totalCount();
    if (total === 0) return 0;
    return Math.round((completedCount() / total) * 100);
  }

  function isCourseComplete() {
    var total = totalCount();
    return total > 0 && completedCount() === total;
  }

  // --- sincronização com a nuvem (só entra em ação se assets/auth.js
  // estiver configurado E o aluno estiver logado — ver syncOnLogin()).
  // Este arquivo nunca fala diretamente com o Firestore/Supabase/etc. —
  // só com o objeto window.NFAuth (assets/auth.js), que é quem sabe o
  // formato de verdade do backend. Trocar de backend não deveria exigir
  // mudar nada aqui. ------------------------------------------------------

  function cloudEnabled() {
    return !!(window.NFAuth && window.NFAuth.isConfigured());
  }

  function cloudUser() {
    return cloudEnabled() ? window.NFAuth.getCurrentUser() : null;
  }

  /** Manda pra nuvem o progresso local atual inteiro (usado a cada aula
   * marcada/desmarcada, ao logar, e ao completar/reiniciar o curso). O
   * documento inteiro é pequeno (só os ids das 62 aulas), então não há
   * necessidade de mandar só a diferença — mais simples e funciona igual
   * em qualquer backend. Não bloqueia a UI (roda em segundo plano). */
  function pushFullProgress(extra) {
    var user = cloudUser();
    if (!user) return;
    var lessons = getLessons();
    var progress = getProgress();
    var payload = Object.assign(
      {
        completedLessons: progress,
        completedCount: countDone(progress, lessons),
        totalLessons: lessons.length,
        email: user.email,
      },
      extra || {}
    );
    window.NFAuth.upsertStudentRecord(user.uid, payload).catch(function (err) {
      /* eslint-disable-next-line no-console */
      console.error("NextFluent: falha ao sincronizar progresso.", err);
    });
  }

  /** Roda uma vez, assim que sabemos se o aluno está logado (ver o
   * NFAuth.onChange lá no final do arquivo). Une o progresso local com o
   * que já estava salvo na nuvem, sem apagar nada dos dois lados — se o
   * aluno já tinha feito aulas neste navegador antes de criar a conta,
   * esse progresso entra na conta; se ele já tinha progresso na nuvem
   * (outro aparelho), esse progresso também aparece aqui. */
  function syncOnLogin(user) {
    if (!user || !cloudEnabled()) return;

    window.NFAuth.getStudentRecord(user.uid)
      .then(function (record) {
        var cloudProgress = (record && record.completedLessons) || {};
        var localProgress = getProgress();
        var merged = Object.assign({}, cloudProgress, localProgress);

        writeJSON(PROGRESS_KEY, merged);
        if (record && record.certificateDate && !readString(DATE_KEY)) {
          writeString(DATE_KEY, record.certificateDate);
        }

        var extra = {
          name: (record && record.name) || user.displayName || "",
        };
        if (!record) extra.createdAt = new Date().toISOString();
        pushFullProgress(extra);

        document.dispatchEvent(new CustomEvent("nextfluent:progress-changed"));
      })
      .catch(function (err) {
        /* eslint-disable-next-line no-console */
        console.error("NextFluent: falha ao carregar progresso da nuvem.", err);
      });
  }

  // --- API local (mesma de sempre — sempre lê/escreve no localStorage
  // primeiro; quando logado, também replica pro Firestore) ----------------

  function setDone(lessonId, done) {
    var progress = getProgress();
    if (done) {
      progress[lessonId] = true;
    } else {
      delete progress[lessonId];
    }
    writeJSON(PROGRESS_KEY, progress);

    var justCompleted = false;
    if (isCourseComplete() && !readString(DATE_KEY)) {
      writeString(DATE_KEY, new Date().toLocaleDateString("pt-BR"));
      justCompleted = true;
    }
    if (!isCourseComplete()) {
      // se o aluno desmarcar uma aula depois de ter concluído tudo,
      // a data de conclusão é limpa (só volta a existir ao completar de novo)
      if (readString(DATE_KEY)) writeString(DATE_KEY, "");
    }

    pushFullProgress(justCompleted ? { certificateDate: getCompletionDate() } : {});

    document.dispatchEvent(new CustomEvent("nextfluent:progress-changed"));
  }

  function getStudentName() {
    var user = cloudUser();
    if (user && (user.displayName || "").trim()) return user.displayName.trim();
    return readString(NAME_KEY);
  }

  function setStudentName(name) {
    name = (name || "").trim();
    writeString(NAME_KEY, name);
    var user = cloudUser();
    if (user && name) {
      user.updateProfile({ displayName: name }).catch(function () {
        /* ignora — o nome ainda fica salvo localmente e no doc abaixo */
      });
      pushFullProgress({ name: name });
    }
  }

  function getCompletionDate() {
    return readString(DATE_KEY);
  }

  function resetProgress() {
    writeJSON(PROGRESS_KEY, {});
    writeString(DATE_KEY, "");
    if (cloudUser()) pushFullProgress({ completedLessons: {}, completedCount: 0, certificateDate: null });
    document.dispatchEvent(new CustomEvent("nextfluent:progress-changed"));
  }

  function findNextLesson() {
    var progress = getProgress();
    var lessons = getLessons();
    for (var i = 0; i < lessons.length; i++) {
      if (progress[lessons[i].id] !== true) return lessons[i];
    }
    return null;
  }

  function levelBreakdown() {
    var progress = getProgress();
    var lessons = getLessons();
    var byLevel = {};
    var order = [];
    for (var i = 0; i < lessons.length; i++) {
      var lvl = lessons[i].level;
      if (!byLevel[lvl]) {
        byLevel[lvl] = { level: lvl, done: 0, total: 0 };
        order.push(lvl);
      }
      byLevel[lvl].total++;
      if (progress[lessons[i].id] === true) byLevel[lvl].done++;
    }
    return order.map(function (lvl) {
      return byLevel[lvl];
    });
  }

  // --- inicializadores de página -----------------------------------------

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function currentPathForNext() {
    return encodeURIComponent(window.location.pathname.split("/").pop() || "index.html");
  }

  function initLessonButton() {
    var widget = document.querySelector("[data-lesson-id]");
    if (!widget) return;
    var lessonId = widget.getAttribute("data-lesson-id");
    var btn = widget.querySelector("[data-lesson-toggle]");
    if (!btn) return;
    var root = widget.getAttribute("data-root") || "";

    function requiresLogin() {
      return cloudEnabled() && !cloudUser();
    }

    function render() {
      if (requiresLogin()) {
        btn.classList.remove("is-done");
        btn.textContent = "Criar conta grátis para salvar seu progresso →";
        btn.setAttribute("aria-pressed", "false");
        return;
      }
      var done = isDone(lessonId);
      btn.classList.toggle("is-done", done);
      btn.textContent = done ? "Aula concluída: desmarcar" : "Marcar aula como concluída";
      btn.setAttribute("aria-pressed", done ? "true" : "false");
    }

    btn.addEventListener("click", function () {
      if (requiresLogin()) {
        window.location.href = root + "cadastro.html?next=" + currentPathForNext();
        return;
      }
      setDone(lessonId, !isDone(lessonId));
      render();
    });

    render();
    document.addEventListener("nextfluent:progress-changed", render);
    document.addEventListener("nextfluent:auth-changed", render);
  }

  function bar(pct) {
    return (
      '<div class="progress-bar" role="progressbar" aria-valuenow="' +
      pct +
      '" aria-valuemin="0" aria-valuemax="100">' +
      '<div class="progress-fill" style="width:' +
      pct +
      '%"></div></div>'
    );
  }

  function initIndexProgress() {
    var mount = document.getElementById("nf-progress");
    if (!mount) return;

    function render() {
      var done = completedCount();
      var total = totalCount();
      var pct = percent();
      var next = findNextLesson();
      var ctaHref = "certificado.html";
      var ctaLabel = "Ver certificado";
      var continueHtml = "";
      if (next && done > 0) {
        continueHtml =
          '<a class="seal-btn outline-ink" href="' + next.href + '">Continuar de onde parei →</a>';
      }
      var signupHtml = "";
      if (cloudEnabled() && !cloudUser()) {
        signupHtml =
          '<a class="seal-btn outline-ink" href="cadastro.html">Criar conta grátis para salvar o progresso →</a>';
      }
      mount.innerHTML =
        '<div class="progress-head">' +
        "<span>" +
        done +
        " de " +
        total +
        " aulas concluídas</span><span>" +
        pct +
        "%</span></div>" +
        bar(pct) +
        '<div class="progress-actions">' +
        continueHtml +
        signupHtml +
        '<a class="seal-btn solid" href="' +
        ctaHref +
        '">' +
        ctaLabel +
        "</a></div>";
    }

    render();
    document.addEventListener("nextfluent:progress-changed", render);
    document.addEventListener("nextfluent:auth-changed", render);
  }

  function initCertificatePage() {
    var mount = document.getElementById("nf-certificate");
    if (!mount) return;

    function renderSignupPrompt() {
      var done = completedCount();
      var total = totalCount();
      mount.innerHTML =
        '<div class="cert-pending">' +
        '<img class="cert-crest" src="assets/brand/mark-badge.svg" width="56" height="56" alt="">' +
        '<div class="eyebrow">Quase lá</div>' +
        "<h2>Crie sua conta grátis para liberar o certificado</h2>" +
        '<p class="cert-pending-count">Você já concluiu ' +
        done +
        " de " +
        total +
        " aulas neste navegador. Crie uma conta (ou entre, se já tiver uma) para guardar esse " +
        "progresso, acessar de qualquer aparelho e emitir seu certificado.</p>" +
        '<div class="cta-row" style="justify-content:center">' +
        '<a class="seal-btn solid" href="cadastro.html?next=certificado.html">Criar conta →</a>' +
        '<a class="seal-btn outline-ink" href="login.html?next=certificado.html">Já tenho conta</a>' +
        "</div></div>";
    }

    function renderIncomplete() {
      var done = completedCount();
      var total = totalCount();
      var pct = percent();
      var next = findNextLesson();
      var nextHtml = next
        ? '<a class="seal-btn solid" href="' + next.href + '">Continuar: ' + escapeHtml(next.title) + " →</a>"
        : "";
      var rows = levelBreakdown()
        .map(function (row) {
          return (
            '<div class="cert-progress-row"><span>' +
            escapeHtml(row.level) +
            "</span><span>" +
            row.done +
            "/" +
            row.total +
            "</span></div>"
          );
        })
        .join("");
      mount.innerHTML =
        '<div class="cert-pending">' +
        '<div class="eyebrow">Certificado ainda não liberado</div>' +
        "<h2>Faltam " +
        (total - done) +
        " aulas para você concluir o curso</h2>" +
        bar(pct) +
        '<p class="cert-pending-count">' +
        done +
        " de " +
        total +
        " aulas concluídas (" +
        pct +
        "%)</p>" +
        '<div class="cert-progress-list">' +
        rows +
        "</div>" +
        nextHtml +
        "</div>";
    }

    function renderCertificate() {
      var name = getStudentName();
      var date = getCompletionDate() || new Date().toLocaleDateString("pt-BR");
      var nameHtml = name
        ? '<div class="cert-name" id="cert-name-display">' + escapeHtml(name) + "</div>"
        : '<div class="cert-name-form">' +
          '<input type="text" id="cert-name-input" placeholder="Digite seu nome completo" maxlength="80">' +
          '<button type="button" class="seal-btn solid" id="cert-name-save">Salvar nome</button>' +
          "</div>";

      mount.innerHTML =
        '<div class="certificate no-print-border">' +
        '<img class="cert-crest" src="assets/brand/mark-badge.svg" width="56" height="56" alt="">' +
        '<div class="certificate-eyebrow">NextFluent · Inglês sem Fronteiras</div>' +
        "<h2>Certificado de Conclusão</h2>" +
        '<p class="certificate-lead">Certificamos que</p>' +
        nameHtml +
        '<p class="certificate-lead">concluiu o curso completo de inglês, do nível <strong>A1 ao C2</strong> ' +
        "(topo da escala internacional CEFR), incluindo o módulo de " +
        "<strong>Inglês para o Mercado de Trabalho</strong>, totalizando " +
        totalCount() +
        " aulas.</p>" +
        '<div class="certificate-date">Concluído em ' +
        date +
        "</div>" +
        '<div class="certificate-actions no-print">' +
        '<button type="button" class="seal-btn solid" id="cert-print">Imprimir / salvar em PDF</button>' +
        '<button type="button" class="seal-btn outline-ink" id="cert-reset">Reiniciar progresso</button>' +
        "</div>" +
        "</div>";

      var saveBtn = document.getElementById("cert-name-save");
      if (saveBtn) {
        saveBtn.addEventListener("click", function () {
          var input = document.getElementById("cert-name-input");
          if (input && input.value.trim()) {
            setStudentName(input.value);
            renderCertificate();
          }
        });
      }
      var printBtn = document.getElementById("cert-print");
      if (printBtn) printBtn.addEventListener("click", function () { window.print(); });

      var resetBtn = document.getElementById("cert-reset");
      if (resetBtn) {
        resetBtn.addEventListener("click", function () {
          if (window.confirm("Isso vai apagar todo o progresso salvo. Continuar?")) {
            resetProgress();
          }
        });
      }
    }

    function render() {
      if (cloudEnabled() && !cloudUser()) {
        renderSignupPrompt();
      } else if (isCourseComplete()) {
        renderCertificate();
      } else {
        renderIncomplete();
      }
    }

    render();
    document.addEventListener("nextfluent:progress-changed", render);
    document.addEventListener("nextfluent:auth-changed", render);
  }

  // --- liga a sincronização com a nuvem, se o cadastro estiver configurado

  if (cloudEnabled()) {
    window.NFAuth.onChange(syncOnLogin);
  }

  window.NF = {
    getLessons: getLessons,
    getProgress: getProgress,
    isDone: isDone,
    setDone: setDone,
    completedCount: completedCount,
    totalCount: totalCount,
    percent: percent,
    isCourseComplete: isCourseComplete,
    getStudentName: getStudentName,
    setStudentName: setStudentName,
    getCompletionDate: getCompletionDate,
    resetProgress: resetProgress,
    findNextLesson: findNextLesson,
    levelBreakdown: levelBreakdown,
    initLessonButton: initLessonButton,
    initIndexProgress: initIndexProgress,
    initCertificatePage: initCertificatePage,
  };
})(window);
