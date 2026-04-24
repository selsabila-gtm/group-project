import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "./SearchResults.css";

function SearchResults() {
    const location = useLocation();
    const navigate = useNavigate();

    const q = new URLSearchParams(location.search).get("q") || "";

    const [competitions, setCompetitions] = useState([]);
    const [teams, setTeams] = useState([]);
    const [datasets, setDatasets] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!q) return;

        setLoading(true);

        Promise.all([
            fetch(`http://127.0.0.1:8000/competitions?search=${encodeURIComponent(q)}`).then(res => res.json()),
            fetch(`http://127.0.0.1:8000/teams?search=${encodeURIComponent(q)}`).then(res => res.json()).catch(() => []),
            fetch(`http://127.0.0.1:8000/datasets?search=${encodeURIComponent(q)}`).then(res => res.json()).catch(() => []),
        ])
            .then(([competitionsData, teamsData, datasetsData]) => {
                setCompetitions(Array.isArray(competitionsData) ? competitionsData : []);
                setTeams(Array.isArray(teamsData) ? teamsData : []);
                setDatasets(Array.isArray(datasetsData) ? datasetsData : []);
            })
            .catch((err) => {
                console.error("Global search error:", err);
            })
            .finally(() => setLoading(false));
    }, [q]);

    return (
        <div className="competitions-shell">
            <Sidebar />

            <div className="competitions-main">
                <Topbar
                    title={`Search results for "${q}"`}
                    subtitle="Results across competitions, datasets, teams, and platform content."
                />

                <div className="search-body">
                    {loading ? (
                        <p>Searching...</p>
                    ) : (
                        <>
                            <section className="search-section">
                                <h2>Competitions</h2>

                                {competitions.length === 0 ? (
                                    <div className="empty-search">No competitions found.</div>
                                ) : (
                                    <div className="search-grid">
                                        {competitions.map((item) => (
                                            <div key={item.id} className="search-card">
                                                <div>
                                                    <h3>{item.title}</h3>
                                                    <p>{item.description}</p>
                                                </div>

                                                <button
                                                    type="button"
                                                    className="search-open-btn"
                                                    onClick={() => navigate(`/competitions/${item.id}`)}
                                                >
                                                    →
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            <section className="search-section">
                                <h2>Teams</h2>

                                {teams.length === 0 ? (
                                    <div className="empty-search">No teams found.</div>
                                ) : (
                                    <div className="search-grid">
                                        {teams.map((team) => (
                                            <div key={team.id} className="search-card">
                                                <div>
                                                    <h3>{team.name}</h3>
                                                    <p>{team.description || "No description"}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            <section className="search-section">
                                <h2>Datasets</h2>

                                {datasets.length === 0 ? (
                                    <div className="empty-search">No datasets found.</div>
                                ) : (
                                    <div className="search-grid">
                                        {datasets.map((dataset) => (
                                            <div key={dataset.id} className="search-card">
                                                <div>
                                                    <h3>{dataset.name}</h3>
                                                    <p>{dataset.description || "No description"}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default SearchResults;