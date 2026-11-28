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

  const CU = "https://attachments.clickup.com/profilePictures/";

  const TEAMS = {};
  for (const [id, name, desc] of POLLS) {
    TEAMS[id] = { name, desc, short: name, members: PEOPLE };
  }

  window.POLL_CONFIG = {
    // Photos: ClickUp profile pictures (or files in avatars/). If a photo fails to load,
    // or a person has none, a coloured circle with their initials is shown instead.
    AVATARS: {
      "Igor S.": CU + "88781568_qnt.jpg",
      "Ilya S.": CU + "260521856_vsb.jpg",
      "Inga L.": CU + "55472252_twj.jpg",
      "Irma R.": CU + "100662569_yoP.jpg",
      "Jurgita B.": CU + "762013_Agw.jpg",
      "Karolis G.": CU + "88709399_suP.jpg",
      "Laura M.": CU + "36525948_p39.jpg",
      "Marius T.": CU + "771854_RrB.jpeg",
      "Mike B.": CU + "8838087_3ai.jpg",
      "Mikhail E.": CU + "42323723_akG.jpg",
      "Nadil K.": CU + "18330400_P1K.jpg",
      "Rajith K.": CU + "222041052_uyt.jpg",
      "Roman M.": CU + "18347211_KSb.jpg",
      "Sasha": CU + "446400003_EKs.jpg",
      "Aistė B.": CU + "88763593_qts.jpg",
      "Aleksandr S.": CU + "760994_PsZ.jpeg",
      "Anatoly N.": CU + "100611936_GFx.jpg",
      "Anna E.": CU + "88767696_1Wz.jpg",
      "Dmitry S.": CU + "302613976_i54.jpg",
      "Filip B.": CU + "762563_wZB.jpg",
      "German N.": CU + "771855_hGy.jpeg",
      "Snezhana V.": CU + "94550396_8AH.jpg",
      "Viktorija Š.": CU + "768313_C3R.jpg",
    },
    TITLE: "Choose the BEST",
    SUBTITLE: "",
    PEOPLE,
    TEAMS,
  };
})();
