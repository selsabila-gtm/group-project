import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "./Competitions.css";

const competitions = [
    {
        category: "TEXT PROCESSING",
        status: "OPEN",
        title: "Semantic Drift v4.2",
        description:
            "Detect subtle shifts in contextual meaning across long-form legal and scientific documents.",
        stat1Label: "TOP SCORE",
        stat1Value: "0.982",
        stat2Label: "REWARD",
        stat2Value: "$12,500",
        footer: "👤👤 +124",
        muted: false,
    },
    {
        category: "AUDIO SYNTHESIS",
        status: "OPEN",
        title: "Echo-Locate Subtones",
        description:
            "Isolate emotional sub-frequencies in noisy environments to improve speech understanding.",
        stat1Label: "PARTICIPANTS",
        stat1Value: "432",
        stat2Label: "DEADLINE",
        stat2Value: "14d",
        footer: "👤👤 +58",
        muted: false,
    },
    {
        category: "TRANSLATION",
        status: "CLOSED",
        title: "Polyglot Zero-Shot",
        description:
            "Evaluation of zero-shot translation capabilities across 14 low-resource languages.",
        stat1Label: "FINAL WINNER",
        stat1Value: "Omni-AI",
        stat2Label: "ACCURACY",
        stat2Value: "94.1%",
        footer: "ARCHIVED",
        muted: true,
    },
    {
        category: "COGNITIVE LOGIC",
        status: "OPEN",
        title: "Recursive Reasoner",
        description:
            "Measure the chain-of-thought efficiency of LLMs when solving recursive symbolic tasks.",
        stat1Label: "ENTRIES",
        stat1Value: "1,024",
        stat2Label: "HARDWARE",
        stat2Value: "H100 Cap",
        footer: "👤 +26",
        muted: false,
    },
];

function Competitions() {
    return (
        <div className="competitions-shell">
            <Sidebar />

            <div className="competitions-main">
                <Topbar
                    title="Active Competitions"
                    subtitle="Push the boundaries of Natural Language Processing. Deploy your models, compete for global rankings, and optimize precision metrics across diverse data domains."
                    showBrowseButton={false}
                />

                <div className="competitions-body">
                    <div className="competitions-toolbar">
                        <div className="task-filters">
                            <span className="filter-title">FILTER BY TASK</span>
                            <button type="button">ALL TASKS</button>
                            <button type="button">SENTIMENT</button>
                            <button type="button">AUDIO SYNC</button>
                            <button type="button">NAMED ENTITY</button>
                        </div>

                        <div className="view-tabs">
                            <button type="button" className="active">
                                All
                            </button>
                            <button type="button">Participating</button>
                            <button type="button">Organizing</button>
                        </div>
                    </div>

                    <div className="view-switch-row">
                        <div></div>
                        <div className="grid-list-switch">
                            <button type="button" className="active">
                                Grid View
                            </button>
                            <button type="button">List View</button>
                        </div>
                    </div>

                    <div className="competition-grid">
                        {competitions.map((item) => (
                            <div
                                key={item.title}
                                className={item.muted ? "competition-card muted" : "competition-card"}
                            >
                                <div className="competition-top">
                                    <span className="competition-category">{item.category}</span>
                                    <span
                                        className={
                                            item.status === "OPEN"
                                                ? "competition-status open"
                                                : "competition-status closed"
                                        }
                                    >
                                        {item.status}
                                    </span>
                                </div>

                                <h3>{item.title}</h3>
                                <p>{item.description}</p>

                                <div className="competition-stats">
                                    <div>
                                        <span>{item.stat1Label}</span>
                                        <strong>{item.stat1Value}</strong>
                                    </div>

                                    <div>
                                        <span>{item.stat2Label}</span>
                                        <strong>{item.stat2Value}</strong>
                                    </div>
                                </div>

                                <div className="competition-footer">
                                    <span>{item.footer}</span>
                                    <button type="button" className="go-btn">
                                        →
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="load-more-box">
                        <p>VIEWING 4 OF 28 ACTIVE EVENTS</p>
                        <button type="button">Load More Entries</button>
                    </div>
                </div>

                <button type="button" className="floating-plus">
                    +
                </button>
            </div>
        </div>
    );
}

export default Competitions;