export const dashboardStats = [
    {
        id: 1,
        icon: "trophy",
        value: "12",
        label: "TOTAL COMPETITIONS",
        badge: "+2 Today",
    },
    {
        id: 2,
        icon: "team",
        value: "04",
        label: "TEAMS JOINED",
        badge: "",
    },
];

export const recentCompetitions = [
    {
        id: 1,
        title: "SQuAD v2.0 Global Bench",
        subtitle: "QUESTION ANSWERING",
        status: "IN PROGRESS",
        score: "--",
        sync: "Just now",
        iconType: "qa",
    },
    {
        id: 2,
        title: "Multi-Lingual Translation",
        subtitle: "TRANSLATION TASK",
        status: "SUBMITTED",
        score: "0.892 BLEU",
        sync: "14 mins ago",
        iconType: "translation",
    },
    {
        id: 3,
        title: "XSum News Summarization",
        subtitle: "SUMMARIZATION",
        status: "DRAFT",
        score: "--",
        sync: "1 hour ago",
        iconType: "document",
    },
];

export const notifications = [
    {
        id: 1,
        type: "primary-card",
        title: 'Project "X-NLI-V2" Archived',
        desc: "Data saved to your persistent storage node.",
        time: "2 minutes ago",
    },
    {
        id: 2,
        type: "simple",
        title: "Tier Upgrade Confirmed",
        desc: "You are now a verified Pro Tier Researcher.",
        time: "1 hour ago",
    },
    {
        id: 3,
        type: "invite",
        title: "Team Invite",
        desc: 'User @nlp_master invited you to "Transformers-R-Us".',
        time: "",
    },
    {
        id: 4,
        type: "simple",
        title: "Login Detected",
        desc: "New session started from OS X 10.15.7",
        time: "4 hours ago",
    },
];

export const competitionFilters = [
    "ALL TASKS",
    "SENTIMENT",
    "AUDIO SYNC",
    "NAMED ENTITY",
];

export const competitionTabs = ["All", "Participating", "Organizing"];

export const competitions = [
    {
        id: 1,
        category: "TEXT PROCESSING",
        status: "OPEN",
        title: "Semantic Drift v4.2",
        desc: "Detect subtle shifts in contextual meaning across long-form legal texts.",
        stat1Label: "TOP SCORE",
        stat1Value: "0.982",
        stat2Label: "REWARD",
        stat2Value: "$12,500",
        footer: "+124",
        archived: false,
    },
    {
        id: 2,
        category: "AUDIO SYNTHESIS",
        status: "OPEN",
        title: "Echo-Locate Subtones",
        desc: "Isolate emotional sub-frequencies in noisy environments to improve speech quality.",
        stat1Label: "PARTICIPANTS",
        stat1Value: "432",
        stat2Label: "DEADLINE",
        stat2Value: "14d",
        footer: "+68",
        archived: false,
    },
    {
        id: 3,
        category: "TRANSLATION",
        status: "CLOSED",
        title: "Polyglot ¿ero-Shot",
        desc: "Evaluation of zero-shot translation capabilities across 14 low-resource languages.",
        stat1Label: "FINAL WINNER",
        stat1Value: "Omni-AI",
        stat2Label: "ACCURACY",
        stat2Value: "94.1%",
        footer: "",
        archived: true,
    },
    {
        id: 4,
        category: "COGNITIVE LOGIC",
        status: "OPEN",
        title: "Recursive Reasoner",
        desc: "Measure the chain-of-thought efficiency of LLMs when solving nested tasks.",
        stat1Label: "ENTRIES",
        stat1Value: "1,024",
        stat2Label: "HARDWARE",
        stat2Value: "H100 Cap",
        footer: "+28",
        archived: false,
    },
];