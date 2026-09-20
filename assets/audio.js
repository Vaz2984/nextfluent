/*
 * NextFluent — áudio das aulas.
 *
 * Usa a Web Speech API (speechSynthesis), nativa do navegador, com as
 * vozes instaladas no sistema operacional: nenhum arquivo de áudio no
 * repositório, nenhuma internet necessária, funciona 100% offline.
 *
 * Dois jeitos de ouvir:
 *   1. Botão "Ouvir a aula" — narra a aula inteira, na ordem do texto:
 *      títulos e explicações com voz em português, exemplos/diálogos em
 *      inglês com voz em inglês (trocando de voz automaticamente), com
 *      pequenas pausas e variações de tom entre trechos pra não sair uma
 *      leitura em bloco só, monótona.
 *   2. Ícone ao lado de cada palavra/frase — ouve só aquele trecho.
 */
(function (window, document) {
  "use strict";

  var RATE_KEY = "nextfluent_audio_rate";
  var VOICE_KEY_PREFIX = "nextfluent_audio_voice_";
  var DEFAULT_RATE = 0.98;
  var PAUSE_MS = 140; // respiro normal entre trechos
  var PAUSE_HEADING_MS = 420; // respiro maior depois de um título de seção

  var synth = window.speechSynthesis || null;
  var enVoice = null;
  var ptVoice = null;
  var narration = []; // [{text, lang, el, pauseAfter}]
  var queueToken = 0; // invalida callbacks de uma reprodução cancelada
  var playingAll = false;
  var currentSingle = null; // elemento tocando via botão individual
  var currentAudioEl = null; // <audio> tocando um arquivo pré-gerado, se houver
  var lessonId = null; // preenchido em initLessonAudio(), usado pra achar o áudio pré-gerado

  // URL base de assets/, resolvida a partir do próprio <script src> — funciona
  // em qualquer profundidade de pasta sem precisar calcular caminho relativo
  var ASSETS_BASE = (function () {
    var atual = document.currentScript;
    if (atual && atual.src) return atual.src.replace(/audio\.js(\?.*)?$/, "");
    return "assets/";
  })();

  // --- limpeza / detecção de idioma ---------------------------------------

  // faixas de emoji + seletor de variação (FE0F) e ZWJ (200D), escritos como
  // sequências de escape pra não haver nenhum caractere de emoji literal no código
  var EMOJI_RE =
    /[\u{1F1E0}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

  var PT_ACCENTS = /[ãâàçéêíõôóúÃÂÀÇÉÊÍÕÔÓÚ]/;
  var PT_WORDS = new RegExp(
    "\\b(" +
      "que|nao|nunca|sempre|voce|para|pelo|pela|pelos|pelas|com|sem|uma|uns|umas|" +
      "mais|menos|como|quando|onde|porque|pois|isso|isto|aquilo|entao|assim|" +
      "pode|podem|deve|devem|use|usar|usamos|coloque|repare|veja|lembre|" +
      "verbo|verbos|frase|frases|exemplo|exemplos|significa|traducao|portugues|ingles|" +
      "ele|ela|eles|elas|nos|seu|sua|seus|suas|dos|das|nas|dele|dela|" +
      "muito|muita|tambem|apenas|ainda|depois|antes|entre|cada|todo|toda|todos|todas|" +
      "certo|errado|correto|incorreto|atencao|dica|obs|estrutura|negativa|interrogativa|" +
      "afirmativa|resposta|pergunta|regra|forma|sentido|significado|caso|casos" +
      ")\\b",
    "gi"
  );

  function deaccent(text) {
    return text.normalize ? text.normalize("NFD").replace(/[̀-ͯ]/g, "") : text;
  }

  function looksPortuguese(text) {
    if (PT_ACCENTS.test(text)) return true;
    var matches = deaccent(text).match(PT_WORDS);
    return !!matches && matches.length >= 1;
  }

  function stripTags(html) {
    var div = document.createElement("div");
    div.innerHTML = html;
    return (div.textContent || "").trim();
  }

  function cleanForSpeech(text) {
    return (text || "")
      .replace(EMOJI_RE, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* Extrai a parte inglesa de uma linha: o que vem antes da "→", sem as
     notas entre parênteses e sem o rótulo de falante ("A:" / "B:"). */
  function englishPart(rawText) {
    var text = rawText.split("→")[0];
    text = text.replace(/\([^)]*\)/g, " ");
    text = text.replace(/^\s*[A-Z]\s*:\s*/, "");
    return cleanForSpeech(text);
  }

  /* Parte depois da "→" (a tradução/explicação em português de uma linha
     de exemplo, quando existe). */
  function afterArrow(rawText) {
    var parts = rawText.split("→");
    if (parts.length < 2) return "";
    return cleanForSpeech(parts.slice(1).join("→").replace(/\([^)]*\)/g, " "));
  }

  function isSpeakable(text) {
    if (!text || text.length < 6) return false;
    if (text.split(/\s+/).length < 2) return false;
    if (!/[a-zA-Z]/.test(text)) return false;
    return !looksPortuguese(text);
  }

  // --- seleção de voz (prioriza vozes "naturais"/de rede, menos robóticas) ---

  function voiceScore(v) {
    var name = (v.name || "").toLowerCase();
    var score = 0;
    if (/google/.test(name)) score += 4;
    if (/natural|neural|enhanced|premium|wavenet|online|siri/.test(name)) score += 4;
    if (v.localService === false) score += 2;
    return score;
  }

  function pickVoiceFor(langPrefix, preferredLocale) {
    if (!synth) return null;
    var all = synth.getVoices() || [];
    var candidates = all.filter(function (v) {
      return (v.lang || "").toLowerCase().indexOf(langPrefix) === 0;
    });
    if (!candidates.length) return null;
    candidates.sort(function (a, b) {
      return voiceScore(b) - voiceScore(a);
    });
    if (preferredLocale) {
      var exact = candidates.filter(function (v) {
        return (v.lang || "").toLowerCase().indexOf(preferredLocale) === 0;
      });
      exact.sort(function (a, b) {
        return voiceScore(b) - voiceScore(a);
      });
      if (exact.length) return exact[0];
    }
    return candidates[0];
  }

  /* Lista as vozes de um idioma, melhores primeiro (pro seletor de voz). */
  function listVoices(langPrefix) {
    if (!synth) return [];
    var all = synth.getVoices() || [];
    return all
      .filter(function (v) {
        return (v.lang || "").toLowerCase().indexOf(langPrefix) === 0;
      })
      .sort(function (a, b) {
        var diff = voiceScore(b) - voiceScore(a);
        return diff !== 0 ? diff : (a.name || "").localeCompare(b.name || "");
      });
  }

  function savedVoiceName(langPrefix) {
    try {
      return window.localStorage.getItem(VOICE_KEY_PREFIX + langPrefix) || "";
    } catch (err) {
      return "";
    }
  }

  function saveVoiceName(langPrefix, name) {
    try {
      window.localStorage.setItem(VOICE_KEY_PREFIX + langPrefix, name || "");
    } catch (err) {
      /* ignora */
    }
  }

  /* Usa a voz que o aluno escolheu, se ela ainda existir no sistema;
     senão cai na melhor voz automática daquele idioma. */
  function resolveVoice(langPrefix, preferredLocale) {
    var chosen = savedVoiceName(langPrefix);
    if (chosen) {
      var match = listVoices(langPrefix).filter(function (v) {
        return v.name === chosen;
      });
      if (match.length) return match[0];
    }
    return pickVoiceFor(langPrefix, preferredLocale);
  }

  function refreshVoices() {
    enVoice = resolveVoice("en", "en-us");
    ptVoice = resolveVoice("pt", "pt-br");
  }

  function getRate() {
    try {
      var stored = parseFloat(window.localStorage.getItem(RATE_KEY));
      return isNaN(stored) ? DEFAULT_RATE : stored;
    } catch (err) {
      return DEFAULT_RATE;
    }
  }

  function setRate(rate) {
    try {
      window.localStorage.setItem(RATE_KEY, String(rate));
    } catch (err) {
      /* ignora */
    }
  }

  /* Pequena variação determinística de tom/ritmo por índice — evita que uma
     sequência longa de frases saia toda no mesmo tom robótico e uniforme. */
  function jitter(i, amount) {
    return Math.sin(i * 12.9898) * amount;
  }

  function clearHighlight() {
    var marked = document.querySelectorAll(".is-speaking");
    for (var i = 0; i < marked.length; i++) marked[i].classList.remove("is-speaking");
  }

  function stop() {
    queueToken++;
    playingAll = false;
    currentSingle = null;
    if (synth) synth.cancel();
    if (currentAudioEl) {
      currentAudioEl.pause();
      currentAudioEl = null;
    }
    clearHighlight();
    updateBar();
  }

  function highlightStart(chunk) {
    clearHighlight();
    if (chunk.el) chunk.el.classList.add("is-speaking");
    if (chunk.el && chunk.el.scrollIntoView) {
      chunk.el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function highlightEnd(chunk) {
    if (chunk.el) chunk.el.classList.remove("is-speaking");
  }

  function speakWithTTS(chunk, index, token, onDone) {
    if (!synth) {
      // sem TTS nativo e sem audio pre-gerado pra esse trecho: nao trava a
      // fila, so pula pro proximo depois da mesma pausa de sempre
      if (onDone) {
        window.setTimeout(function () {
          if (token === queueToken) onDone();
        }, chunk.pauseAfter || PAUSE_MS);
      }
      return;
    }
    var lang = chunk.lang === "en" ? "en" : "pt";
    var v = lang === "en" ? enVoice : ptVoice;
    var utter = new window.SpeechSynthesisUtterance(chunk.text);
    if (v) utter.voice = v;
    utter.lang = (v && v.lang) || (lang === "en" ? "en-US" : "pt-BR");
    utter.rate = Math.max(0.5, getRate() + jitter(index, 0.035));
    utter.pitch = Math.max(0.7, 1 + jitter(index + 7, 0.05));

    highlightStart(chunk);

    utter.onend = function () {
      if (token !== queueToken) return;
      highlightEnd(chunk);
      var pause = chunk.pauseAfter || PAUSE_MS;
      window.setTimeout(function () {
        if (token === queueToken && onDone) onDone();
      }, pause);
    };
    utter.onerror = function () {
      if (token !== queueToken) return;
      highlightEnd(chunk);
      if (onDone) onDone();
    };
    synth.speak(utter);
  }

  /* Tenta tocar o .mp3 pré-gerado (assets/audio/<aula>/NNN.mp3, ver
     scripts/gerar_audio.py) pro trecho; se não existir ou der erro, cai pra
     voz do navegador automaticamente — nada quebra pras aulas ainda não
     geradas, e a qualidade sobe sozinha assim que existirem os arquivos. */
  function speakChunk(chunk, index, token, onDone) {
    if (!lessonId || index == null || index < 0) {
      speakWithTTS(chunk, index, token, onDone);
      return;
    }

    var caminho = ASSETS_BASE + "audio/" + lessonId.replace(/\//g, "__") + "/" +
      String(index).padStart(3, "0") + ".mp3";
    var audio = new window.Audio(caminho);
    audio.playbackRate = Math.max(0.5, getRate());
    var caiuPraTts = false;

    var paraTts = function () {
      if (caiuPraTts) return;
      caiuPraTts = true;
      if (currentAudioEl === audio) currentAudioEl = null;
      speakWithTTS(chunk, index, token, onDone);
    };

    audio.addEventListener("ended", function () {
      if (token !== queueToken) return;
      currentAudioEl = null;
      highlightEnd(chunk);
      var pause = chunk.pauseAfter || PAUSE_MS;
      window.setTimeout(function () {
        if (token === queueToken && onDone) onDone();
      }, pause);
    });
    audio.addEventListener("error", paraTts);

    highlightStart(chunk);
    currentAudioEl = audio;
    var promessa = audio.play();
    if (promessa && promessa.catch) promessa.catch(paraTts);
  }

  function playFrom(index) {
    if (index >= narration.length) {
      stop();
      return;
    }
    playingAll = true;
    updateBar();
    var token = queueToken;
    speakChunk(narration[index], index, token, function () {
      if (playingAll) playFrom(index + 1);
    });
  }

  function playSingle(chunk, el, narrationIndex) {
    queueToken++;
    var token = queueToken;
    playingAll = false;
    currentSingle = el;
    updateBar();
    var indice = narrationIndex != null && narrationIndex >= 0 ? narrationIndex : -1;
    speakChunk({ text: chunk.text, lang: chunk.lang, el: el, pauseAfter: 0 }, indice, token, function () {
      if (token === queueToken) {
        currentSingle = null;
        updateBar();
      }
    });
  }

  // --- botões individuais (ícone de play ao lado de um trecho) -----------

  function makeButton(text, lang) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "say-btn";
    var label = lang === "en" ? "Ouvir em inglês" : "Ouvir";
    btn.title = label;
    btn.setAttribute("aria-label", label + ": " + text);
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">' +
      '<path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4z"/>' +
      '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
      'd="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>' +
      "</svg>";
    return btn;
  }

  function attachButton(el, text, lang, narrationIndex) {
    var btn = makeButton(text, lang);
    el.appendChild(btn);
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (currentSingle === el && ((synth && synth.speaking) || currentAudioEl)) {
        stop();
        return;
      }
      playSingle({ text: text, lang: lang }, el, narrationIndex);
    });
  }

  // cabeçalhos de tabela cujo conteúdo da coluna é inglês (vocabulário,
  // pronomes, modais, phrasal verbs...) — vistos no conteúdo real do curso
  var ENGLISH_COLUMN_HEADERS = [
    "inglês", "ingles", "english", "palavra", "pronome", "modal",
    "verbo", "expressão", "expressao", "frase", "preposição", "preposicao",
    "phrasal verb", "phrasal verbs",
  ];

  function englishColumnIndex(table) {
    var headers = table.querySelectorAll("thead th");
    for (var h = 0; h < headers.length; h++) {
      var label = (headers[h].textContent || "").trim().toLowerCase();
      if (ENGLISH_COLUMN_HEADERS.indexOf(label) !== -1) return h;
    }
    return -1;
  }

  // --- construção do roteiro de narração (ordem real do documento) -------

  function addChunk(text, lang, el, pauseAfter) {
    text = cleanForSpeech(text);
    if (!text) return -1;
    narration.push({ text: text, lang: lang, el: el || null, pauseAfter: pauseAfter || 0 });
    return narration.length - 1;
  }

  function narrateTable(table) {
    var col = englishColumnIndex(table);
    if (col === -1) return;
    var rows = table.querySelectorAll("tbody tr");
    for (var r = 0; r < rows.length; r++) {
      var cells = rows[r].children;
      var enCell = cells[col];
      if (!enCell) continue;
      var enText = englishPart(enCell.textContent || "");
      if (!enText || !/[a-zA-Z]/.test(enText)) continue;
      var idxTabela = addChunk(enText, "en", enCell, 0);
      attachButton(enCell, enText, "en", idxTabela);

      // a coluna seguinte (quando existe) costuma ser a tradução/explicação
      var ptCell = cells[col + 1];
      if (ptCell) {
        var ptText = cleanForSpeech(ptCell.textContent || "");
        if (ptText) addChunk(ptText, "pt", ptCell, PAUSE_MS);
      }
    }
  }

  function narrateBlockquote(blockquote) {
    var paragraphs = blockquote.querySelectorAll("p");
    for (var i = 0; i < paragraphs.length; i++) {
      var para = paragraphs[i];
      var lines = para.innerHTML.split("\n");
      var lineEnglish = [];
      for (var l = 0; l < lines.length; l++) {
        var plain = stripTags(lines[l]);
        lineEnglish.push(isSpeakable(englishPart(plain)));
      }

      var rebuilt = lines
        .map(function (line, idx) {
          if (!lineEnglish[idx]) return line;
          return '<span class="say-line" data-say-line="' + idx + '">' + line + "</span>";
        })
        .join("\n");
      para.innerHTML = rebuilt;

      var spans = para.querySelectorAll("[data-say-line]");
      var spanCursor = 0;
      for (var idx2 = 0; idx2 < lines.length; idx2++) {
        var rawLine = stripTags(lines[idx2]);
        if (!rawLine) continue;
        if (lineEnglish[idx2]) {
          var span = spans[spanCursor++];
          var enText2 = englishPart(rawLine);
          var idxBlockquote = addChunk(enText2, "en", span, 0);
          attachButton(span, enText2, "en", idxBlockquote);
          var ptTranslation = afterArrow(rawLine);
          if (ptTranslation) addChunk(ptTranslation, "pt", para, PAUSE_MS);
        } else {
          addChunk(rawLine, "pt", para, 0);
        }
      }
    }
  }

  function narrateHeadingOrText(el, lang) {
    addChunk(el.textContent, lang, el, PAUSE_HEADING_MS);
  }

  /* Percorre o artigo em ordem real de leitura (títulos, parágrafos, listas,
     tabelas e blockquotes intercalados) montando o roteiro de narração e,
     de quebra, injeta os ícones de play individuais em cada trecho falável. */
  function buildNarrationAndButtons(article) {
    var h1 = article.querySelector("h1");
    if (h1) narrateHeadingOrText(h1, "pt");

    var nodes = article.querySelectorAll("h2, h3, p, li, blockquote, table");
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var tag = node.tagName;

      if (tag === "P" || tag === "LI") {
        if (node.closest("blockquote") || node.closest("table")) continue;
        addChunk(node.textContent, "pt", node, tag === "LI" ? 0 : PAUSE_MS);
        continue;
      }
      if (tag === "H2" || tag === "H3") {
        narrateHeadingOrText(node, "pt");
        continue;
      }
      if (tag === "TABLE") {
        narrateTable(node);
        continue;
      }
      if (tag === "BLOCKQUOTE") {
        narrateBlockquote(node);
      }
    }
  }

  // --- barra de áudio no topo da aula ------------------------------------

  function updateBar() {
    var bar = document.getElementById("nf-audio-bar");
    if (!bar) return;
    var playBtn = bar.querySelector("[data-audio-play]");
    if (!playBtn) return;
    playBtn.textContent = playingAll ? "Parar" : "Ouvir a aula";
    playBtn.classList.toggle("is-playing", playingAll);
  }

  /* Monta o <select> de vozes de um idioma, melhores primeiro. */
  function voicePickerHtml(langPrefix, label) {
    var voices = listVoices(langPrefix);
    if (!voices.length) {
      return (
        '<div class="audio-voice-row"><span class="audio-voice-label">' +
        label +
        '</span><span class="audio-voice-empty">nenhuma voz deste idioma instalada no sistema</span></div>'
      );
    }
    var current = (langPrefix === "en" ? enVoice : ptVoice) || voices[0];
    var options = voices
      .map(function (v) {
        var natural = voiceScore(v) >= 4 ? " (natural)" : "";
        var selected = v.name === current.name ? " selected" : "";
        return (
          '<option value="' +
          v.name.replace(/"/g, "&quot;") +
          '"' +
          selected +
          ">" +
          v.name +
          natural +
          "</option>"
        );
      })
      .join("");
    return (
      '<div class="audio-voice-row"><span class="audio-voice-label">' +
      label +
      '</span><select data-voice-select="' +
      langPrefix +
      '">' +
      options +
      '</select><button type="button" class="audio-voice-test" data-voice-test="' +
      langPrefix +
      '">Testar</button></div>'
    );
  }

  function wireVoicePicker(bar, langPrefix, sampleText) {
    var select = bar.querySelector('[data-voice-select="' + langPrefix + '"]');
    if (!select) return;
    select.addEventListener("change", function () {
      saveVoiceName(langPrefix, select.value);
      refreshVoices();
    });
    var testBtn = bar.querySelector('[data-voice-test="' + langPrefix + '"]');
    if (!testBtn) return;
    testBtn.addEventListener("click", function () {
      saveVoiceName(langPrefix, select.value);
      refreshVoices();
      queueToken++;
      playingAll = false;
      speakChunk({ text: sampleText, lang: langPrefix, el: null, pauseAfter: 0 }, 0, queueToken, null);
    });
  }

  function buildBar() {
    var bar = document.getElementById("nf-audio-bar");
    if (!bar) return;

    if (!narration.length) {
      bar.innerHTML = "";
      return;
    }
    if (!synth && !lessonId) {
      // sem speechSynthesis e sem como localizar audio pre-gerado: nada a
      // oferecer nesta pagina (nao deveria acontecer numa aula de verdade)
      bar.innerHTML =
        '<p class="audio-unavailable">Seu navegador não oferece leitura em voz alta ' +
        "nesta página.</p>";
      return;
    }

    var rate = getRate();
    bar.innerHTML =
      '<div class="audio-bar-inner">' +
      '<button type="button" class="audio-play" data-audio-play>Ouvir a aula</button>' +
      '<span class="audio-count">narração com voz em português e inglês</span>' +
      '<label class="audio-rate">Velocidade' +
      '<select data-audio-rate>' +
      '<option value="0.75">Bem devagar</option>' +
      '<option value="0.88">Devagar</option>' +
      '<option value="0.98">Normal</option>' +
      '<option value="1.15">Rápido</option>' +
      "</select></label>" +
      '<button type="button" class="audio-voices-toggle" data-audio-voices>Vozes</button>' +
      "</div>" +
      '<div class="audio-voices" data-audio-voices-panel hidden>' +
      voicePickerHtml("pt", "Voz em português") +
      voicePickerHtml("en", "Voz em inglês") +
      '<p class="audio-voices-hint">Vozes marcadas com (natural) soam bem mais humanas. ' +
      "Não achou nenhuma? Dá pra instalar vozes naturais nas configurações de " +
      "fala do seu sistema. Veja o README, seção Áudio das aulas.</p>" +
      "</div>";

    var select = bar.querySelector("[data-audio-rate]");
    select.value = String(rate);
    if (select.selectedIndex === -1) select.value = String(DEFAULT_RATE);
    select.addEventListener("change", function () {
      setRate(parseFloat(select.value));
    });

    bar.querySelector("[data-audio-play]").addEventListener("click", function () {
      if (playingAll) {
        stop();
      } else {
        playFrom(0);
      }
    });

    var panel = bar.querySelector("[data-audio-voices-panel]");
    bar.querySelector("[data-audio-voices]").addEventListener("click", function () {
      panel.hidden = !panel.hidden;
    });
    wireVoicePicker(bar, "pt", "Esta é a voz que vai explicar a aula em português.");
    wireVoicePicker(bar, "en", "This is the voice for the English examples.");
  }

  function initLessonAudio() {
    var article = document.querySelector("article");
    if (!article) return;

    // audio pre-gerado (scripts/gerar_audio.py) nao depende do speechSynthesis
    // do navegador, entao so paramos aqui se nem tiver artigo pra narrar
    var widget = document.querySelector("[data-lesson-id]");
    lessonId = widget ? widget.getAttribute("data-lesson-id") : null;

    if (synth) {
      refreshVoices();
      if ((!enVoice || !ptVoice) && typeof synth.addEventListener === "function") {
        // no Chrome a lista de vozes carrega de forma assíncrona
        synth.addEventListener("voiceschanged", function () {
          refreshVoices();
          buildBar();
        });
      }
    }

    buildNarrationAndButtons(article);
    buildBar();

    // para a fala/audio ao sair da página (evita continuar em outra aba)
    window.addEventListener("beforeunload", function () {
      if (synth) synth.cancel();
      if (currentAudioEl) currentAudioEl.pause();
    });
  }

  window.NFAudio = {
    initLessonAudio: initLessonAudio,
    stop: stop,
    isSpeakable: isSpeakable,
    englishPart: englishPart,
    looksPortuguese: looksPortuguese,
  };
})(window, document);
