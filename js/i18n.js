(function () {
  // UI languages. English is the default; the choice is kept in localStorage.
  const LANG_KEY = "team-rank-poll-lang";
  const LANGS = [
    ["en", "EN", "English"],
    ["lt", "LT", "Lietuvių"],
    ["ru", "RU", "Русский"],
    ["kk", "KZ", "Қазақша"],
  ];

  // Plural word for a vote count, per language.
  const VOTES = {
    en: (n) => (n === 1 ? "vote" : "votes"),
    lt: (n) => (n % 10 === 1 && n % 100 !== 11 ? "balsas" : n % 10 >= 2 && n % 10 <= 9 && (n % 100 < 10 || n % 100 >= 20) ? "balsai" : "balsų"),
    ru: (n) => (n % 10 === 1 && n % 100 !== 11 ? "голос" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "голоса" : "голосов"),
    kk: () => "дауыс",
  };

  const S = {
    en: {
      title: "Choose the BEST",
      loading: "Loading…", loadingResults: "Loading results…", error: "Error", home: "← Home", back: "← Back",
      dbOnline: "☁ Database online, votes: {n}", dbDown: "⚠ Database unavailable, votes may not sync",
      people: "{n} people", voted: "✓ Voted", letsVote: "Let’s vote →", yourVotes: "Your votes: {a} of {b}",
      alreadyVoted: "You have already voted in this poll.",
      boardHint: "Drag people onto the board: <strong>the higher, the better</strong>. Leave anyone you don't know in the middle, in “No idea”. Horizontal position doesn't matter.",
      noIdea: "No idea / don't work with them", rated: "Rated: {a} of {b}", submit: "Submit", saving: "Saving…",
      needOne: "Place at least one person on the board (above or below “No idea”).",
      thanks: "Thanks! Your vote for “{name}” is saved.", saveFailed: "Could not save",
      noVotes: "no votes", accessDenied: "Access denied.", resultsTitle: "Results", results: "📊 Results", noVotesYet: "No votes yet",
      overall: "🏆 Overall ranking", scale: "0–100: top of board = 100, bottom = 0",
      person: "Person", total: "Total", average: "average", votesCol: "Votes", ratedBy: "rated by",
      ballotsLine: "Ballots: <strong>{n}</strong> · score = height on the board: top = 100, bottom = 0 (older list ballots: 1st place = 100, last = 0); “No idea” is not counted",
      dbOnlineBallots: "☁ Database online, ballots: {n}", dbDownErr: "⚠ Database unavailable: {e}",
      resetTitle: "Reset the poll", resetDesc: "Deletes ALL votes from the shared database. This cannot be undone.",
      resetBtn: "Reset the poll", resetConfirm: "DELETE ALL VOTES from the shared database? This cannot be undone.",
      resetDone: "Poll reset. All votes deleted.", resetFailed: "Reset failed",
      errAlreadyDevice: "You have already voted in this poll from this device",
      errEmpty: "Empty ballot: place at least one person on the board", errSave: "Could not save ({s})",
      polls: {
        speed: ["Speed at work", "Periodic updates, reaction to posts, fast answers to your questions, etc."],
        comm: ["Communication", "Nice, friendly, help as much as you ask, always ready for help."],
        nobug: ["No-bug guarantee", "Closing tasks and mostly none of them have obvious bugs."],
        amount: ["Amount of work", "Person produces a huge amount of work (huge big tasks, or a lot of small tasks)."],
        punct: ["Punctuality", "Person is always online during working hours and helps later on rare urgent requests."],
        ai: ["AI skills", "Person uses AI and agents in daily work."],
      },
    },
    lt: {
      title: "Išrink GERIAUSIUS",
      loading: "Kraunama…", loadingResults: "Kraunami rezultatai…", error: "Klaida", home: "← Pradžia", back: "← Atgal",
      dbOnline: "☁ Duomenų bazė veikia, balsų: {n}", dbDown: "⚠ Duomenų bazė nepasiekiama, balsai gali nesisinchronizuoti",
      people: "{n} žmonės", voted: "✓ Balsuota", letsVote: "Balsuoti →", yourVotes: "Jūsų balsai: {a} iš {b}",
      alreadyVoted: "Jūs jau balsavote šioje apklausoje.",
      boardHint: "Tempkite žmones į lauką: <strong>kuo aukščiau, tuo geriau</strong>. Tuos, kurių nepažįstate, palikite viduryje, skiltyje „Nežinau“. Padėtis horizontaliai neturi reikšmės.",
      noIdea: "Nežinau / nedirbu su jais", rated: "Įvertinta: {a} iš {b}", submit: "Pateikti", saving: "Išsaugoma…",
      needOne: "Padėkite į lauką bent vieną žmogų (virš arba po „Nežinau“).",
      thanks: "Ačiū! Jūsų balsas už „{name}“ išsaugotas.", saveFailed: "Nepavyko išsaugoti",
      noVotes: "nėra balsų", accessDenied: "Prieiga uždrausta.", resultsTitle: "Rezultatai", results: "📊 Rezultatai", noVotesYet: "Balsų dar nėra",
      overall: "🏆 Bendras reitingas", scale: "0–100: lauko viršus = 100, apačia = 0",
      person: "Žmogus", total: "Iš viso", average: "vidurkis", votesCol: "Balsai", ratedBy: "įvertino",
      ballotsLine: "Biuletenių: <strong>{n}</strong> · balas = aukštis lauke: viršus = 100, apačia = 0 (senesni sąrašo biuleteniai: 1 vieta = 100, paskutinė = 0); „Nežinau“ neskaičiuojama",
      dbOnlineBallots: "☁ Duomenų bazė veikia, biuletenių: {n}", dbDownErr: "⚠ Duomenų bazė nepasiekiama: {e}",
      resetTitle: "Atstatyti apklausą", resetDesc: "Ištrins VISUS balsus iš bendros duomenų bazės. To atšaukti negalima.",
      resetBtn: "Atstatyti apklausą", resetConfirm: "IŠTRINTI VISUS BALSUS iš bendros duomenų bazės? To atšaukti negalima.",
      resetDone: "Apklausa atstatyta. Visi balsai ištrinti.", resetFailed: "Atstatyti nepavyko",
      errAlreadyDevice: "Jūs jau balsavote šioje apklausoje iš šio įrenginio",
      errEmpty: "Tuščias biuletenis: padėkite į lauką bent vieną žmogų", errSave: "Nepavyko išsaugoti ({s})",
      polls: {
        speed: ["Darbo greitis", "Reguliarūs atnaujinimai, reakcija į įrašus, greiti atsakymai į jūsų klausimus ir pan."],
        comm: ["Bendravimas", "Malonus, draugiškas, padeda tiek, kiek paprašai, visada pasiruošęs padėti."],
        nobug: ["Darbas be klaidų", "Užbaigia užduotis, ir daugumoje jų nėra akivaizdžių klaidų."],
        amount: ["Darbo kiekis", "Atlieka labai daug darbo (didelės užduotys arba daug mažų užduočių)."],
        punct: ["Punktualumas", "Darbo valandomis visada prisijungęs ir retais skubiais atvejais padeda ir vėliau."],
        ai: ["DI įgūdžiai", "Kasdieniame darbe naudoja dirbtinį intelektą ir agentus."],
      },
    },
    ru: {
      title: "Выбери ЛУЧШИХ",
      loading: "Загрузка…", loadingResults: "Загрузка результатов…", error: "Ошибка", home: "← На главную", back: "← Назад",
      dbOnline: "☁ База онлайн, голосов: {n}", dbDown: "⚠ База недоступна, голоса могут не синхронизироваться",
      people: "{n} человек", voted: "✓ Голос учтён", letsVote: "Голосовать →", yourVotes: "Ваши голоса: {a} из {b}",
      alreadyVoted: "Вы уже проголосовали в этом опросе.",
      boardHint: "Перетащите людей на поле: <strong>чем выше, тем лучше</strong>. Кого не знаете, оставьте в середине, в «Не знаю». Положение по горизонтали не важно.",
      noIdea: "Не знаю / не работаю с ними", rated: "Оценено: {a} из {b}", submit: "Отправить", saving: "Сохраняем…",
      needOne: "Поставьте на поле хотя бы одного человека (выше или ниже «Не знаю»).",
      thanks: "Спасибо! Голос за «{name}» сохранён.", saveFailed: "Не удалось сохранить",
      noVotes: "нет голосов", accessDenied: "Нет доступа.", resultsTitle: "Результаты", results: "📊 Результаты", noVotesYet: "Пока нет голосов",
      overall: "🏆 Общий рейтинг", scale: "0–100: верх поля = 100, низ = 0",
      person: "Человек", total: "Итого", average: "среднее", votesCol: "Голосов", ratedBy: "оценили",
      ballotsLine: "Бюллетеней: <strong>{n}</strong> · балл = высота на поле: верх = 100, низ = 0 (старые бюллетени-списки: 1-е место = 100, последнее = 0); «Не знаю» не учитывается",
      dbOnlineBallots: "☁ База онлайн, бюллетеней: {n}", dbDownErr: "⚠ База недоступна: {e}",
      resetTitle: "Сбросить голосование", resetDesc: "Удалит ВСЕ голоса из общей базы. Действие необратимо.",
      resetBtn: "Сбросить голосование", resetConfirm: "УДАЛИТЬ ВСЕ ГОЛОСА из общей базы? Это нельзя отменить.",
      resetDone: "Голосование сброшено. Все голоса удалены.", resetFailed: "Сброс не удался",
      errAlreadyDevice: "Вы уже голосовали в этом опросе с этого устройства",
      errEmpty: "Пустой бюллетень: поставьте на поле хотя бы одного человека", errSave: "Не удалось сохранить ({s})",
      polls: {
        speed: ["Скорость в работе", "Регулярные апдейты, реакция на сообщения, быстрые ответы на ваши вопросы и т.д."],
        comm: ["Коммуникация", "Приятный, дружелюбный, помогает столько, сколько попросишь, всегда готов помочь."],
        nobug: ["Гарантия без багов", "Закрывает задачи, и в большинстве из них нет очевидных багов."],
        amount: ["Объём работы", "Делает огромный объём работы (большие задачи или много мелких)."],
        punct: ["Пунктуальность", "Всегда онлайн в рабочее время и помогает позже при редких срочных запросах."],
        ai: ["Навыки ИИ", "Использует ИИ и агентов в ежедневной работе."],
      },
    },
    kk: {
      title: "ЕҢ ҮЗДІКТЕРДІ таңда",
      loading: "Жүктелуде…", loadingResults: "Нәтижелер жүктелуде…", error: "Қате", home: "← Басты бет", back: "← Артқа",
      dbOnline: "☁ Дерекқор қосулы, дауыстар: {n}", dbDown: "⚠ Дерекқор қолжетімсіз, дауыстар синхрондалмауы мүмкін",
      people: "{n} адам", voted: "✓ Дауыс берілді", letsVote: "Дауыс беру →", yourVotes: "Сіздің дауыстарыңыз: {b} ішінен {a}",
      alreadyVoted: "Сіз бұл сауалнамада дауыс бердіңіз.",
      boardHint: "Адамдарды алаңға сүйреңіз: <strong>неғұрлым жоғары болса, соғұрлым жақсы</strong>. Танымайтын адамдарды ортада, «Білмеймін» бөлігінде қалдырыңыз. Көлденең орналасудың маңызы жоқ.",
      noIdea: "Білмеймін / бірге жұмыс істемеймін", rated: "Бағаланды: {b} ішінен {a}", submit: "Жіберу", saving: "Сақталуда…",
      needOne: "Алаңға кемінде бір адамды қойыңыз («Білмеймін» бөлігінен жоғары немесе төмен).",
      thanks: "Рақмет! «{name}» бойынша дауысыңыз сақталды.", saveFailed: "Сақтау мүмкін болмады",
      noVotes: "дауыс жоқ", accessDenied: "Қол жеткізу жоқ.", resultsTitle: "Нәтижелер", results: "📊 Нәтижелер", noVotesYet: "Әзірге дауыс жоқ",
      overall: "🏆 Жалпы рейтинг", scale: "0–100: алаңның жоғарғы жағы = 100, төменгі жағы = 0",
      person: "Адам", total: "Барлығы", average: "орташа", votesCol: "Дауыстар", ratedBy: "бағалағандар",
      ballotsLine: "Бюллетеньдер: <strong>{n}</strong> · балл = алаңдағы биіктік: жоғары = 100, төмен = 0 (ескі тізім-бюллетеньдер: 1-орын = 100, соңғы = 0); «Білмеймін» есептелмейді",
      dbOnlineBallots: "☁ Дерекқор қосулы, бюллетеньдер: {n}", dbDownErr: "⚠ Дерекқор қолжетімсіз: {e}",
      resetTitle: "Дауыс беруді тазалау", resetDesc: "Ортақ дерекқордағы БАРЛЫҚ дауыстарды өшіреді. Бұл әрекетті қайтару мүмкін емес.",
      resetBtn: "Дауыс беруді тазалау", resetConfirm: "Ортақ дерекқордағы БАРЛЫҚ ДАУЫСТАРДЫ өшіру керек пе? Мұны қайтару мүмкін емес.",
      resetDone: "Дауыс беру тазаланды. Барлық дауыстар өшірілді.", resetFailed: "Тазалау сәтсіз аяқталды",
      errAlreadyDevice: "Сіз бұл сауалнамада осы құрылғыдан дауыс бердіңіз",
      errEmpty: "Бос бюллетень: алаңға кемінде бір адамды қойыңыз", errSave: "Сақтау мүмкін болмады ({s})",
      polls: {
        speed: ["Жұмыс жылдамдығы", "Тұрақты жаңартулар, хабарламаларға жауап беру, сұрақтарыңызға жылдам жауаптар және т.б."],
        comm: ["Қарым-қатынас", "Сыпайы, мейірімді, сұрағаныңызша көмектеседі, әрқашан көмектесуге дайын."],
        nobug: ["Қатесіз жұмыс кепілдігі", "Тапсырмаларды аяқтайды, олардың көбінде айқын қателер болмайды."],
        amount: ["Жұмыс көлемі", "Өте көп жұмыс атқарады (үлкен тапсырмалар немесе көптеген ұсақ тапсырмалар)."],
        punct: ["Уақытқа ұқыптылық", "Жұмыс уақытында әрқашан онлайн және сирек шұғыл өтініштерде кейінірек те көмектеседі."],
        ai: ["ЖИ дағдылары", "Күнделікті жұмыста жасанды интеллект пен агенттерді қолданады."],
      },
    },
  };

  function readLang() {
    try {
      const v = localStorage.getItem(LANG_KEY);
      if (v && S[v]) return v;
    } catch (_) {}
    return "en";
  }
  let lang = readLang();

  function t(key, vars) {
    let s = (S[lang] && S[lang][key]) || S.en[key] || key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
    return s;
  }

  function votes(n) {
    if (n === 0) return t("noVotes");
    return n + " " + (VOTES[lang] || VOTES.en)(n);
  }

  // Put this language's title and poll names/descriptions into the shared config.
  function applyToConfig() {
    const cfg = window.POLL_CONFIG;
    if (!cfg) return;
    cfg.TITLE = t("title");
    const polls = (S[lang] && S[lang].polls) || S.en.polls;
    for (const id in cfg.TEAMS) {
      const p = polls[id] || S.en.polls[id];
      if (!p) continue;
      cfg.TEAMS[id].name = cfg.TEAMS[id].short = p[0];
      cfg.TEAMS[id].desc = p[1];
    }
    document.documentElement.lang = lang === "kk" ? "kk" : lang;
  }

  function setLang(next) {
    if (!S[next] || next === lang) return false;
    lang = next;
    try { localStorage.setItem(LANG_KEY, next); } catch (_) {}
    applyToConfig();
    return true;
  }

  applyToConfig();
  window.I18N = { t, votes, setLang, getLang: () => lang, LANGS };
})();
