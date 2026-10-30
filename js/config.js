(function () {
  // One team, six polls. Every poll ranks the same people.
  const PEOPLE = [
    "Igor S.","Ilya S.","Inga L.","Irma R.","Jurgita B.",
    "Karolis G.","Laura M.","Marius T.","Mike B.","Mikhail E.",
    "Nadil K.","Rajith K.","Roman M.","Sasha","Aistė B.",
    "Aleksandr S.","Anatoly N.","Anna E.","Dmitry S.","Filip B.",
    "German N.","Snezhana V.","Viktorija Š."
  ];

  const POLLS = [
    ["speed", "Speed at work", "Periodic updates, reaction to posts, fast answers to your questions, etc."],
    ["comm", "Communication", "Nice, friendly, help as much as you ask, always ready for help."],
    ["nobug", "No-bug guarantee", "Closing tasks and mostly none of them have obvious bugs."],
    ["amount", "Amount of work", "Person produces a huge amount of work (huge big tasks, or a lot of small tasks)."],
    ["punct", "Punctuality", "Person is always online during working hours and helps later on rare urgent requests."],
    ["ai", "AI skills", "Person uses AI and agents in daily work."],
  ];

  const TEAMS = {};
  for (const [id, name, desc] of POLLS) {
    TEAMS[id] = { name, desc, short: name, members: PEOPLE };
  }

  window.POLL_CONFIG = {
    ADMIN_SECRET: "rank2026admin",
    TITLE: "Рейтинг команды",
    SUBTITLE: "6 голосований, одни и те же люди. В каждом перетащите всех от лучшего (верх) к худшему (низ). Один голос на каждое голосование с устройства.",
    PEOPLE,
    TEAMS,
  };
})();
