import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "./CreateCompetition.css";

const steps = [
    "Basic Info",
    "Evaluation",
    "Rules",
    "Complexity",
    "Datasets",
    "Milestones",
];

const taskTypes = [
    "TEXT PROCESSING",
    "AUDIO SYNTHESIS",
    "TRANSLATION",
    "COGNITIVE LOGIC",
    "QUESTION ANSWERING",
    "SUMMARIZATION",
];

const primaryMetrics = [
    "Accuracy",
    "F1 Score",
    "BLEU",
    "ROUGE-L",
    "WER",
    "Exact Match",
];

const complexityLevels = [
    {
        title: "Level 1: Basic Text Classification",
        description: "Simple categorization tasks",
    },
    {
        title: "Level 2: Intermediate NER",
        description: "Named entity recognition with moderate complexity",
    },
    {
        title: "Level 3: Advanced Semantic Mapping",
        description: "Requires transformer architecture with attention mechanisms",
    },
    {
        title: "Level 4: Expert Multi-Task Learning",
        description: "Complex multi-objective optimization",
    },
];

const skillsList = [
    "Python Programming",
    "Machine Learning",
    "Deep Learning",
    "Natural Language Processing",
    "Data Analysis",
    "Statistics",
    "PyTorch",
    "TensorFlow",
    "Transformers",
    "Data Preprocessing",
    "Model Evaluation",
    "Research Skills",
];

const initialForm = {
    competitionName: "",
    taskType: "",
    description: "",
    startDate: "",
    endDate: "",
    prizePool: "",

    primaryMetric: "",
    secondaryMetric: "",

    maxTeams: "",
    minMembers: "",
    maxMembers: "",
    mergeDeadline: "",
    requiredSkills: [],
    maxSubmissionsPerDay: "",
    allowExternalData: true,
    allowPretrainedModels: true,
    requireCodeSharing: false,
    additionalRules: "",

    complexityLevel: 0,

    datasets: [],
    milestones: [],
    validationDate: "",
    freezeDate: "",
};

function CreateCompetition() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState(initialForm);

    const progressPercent = ((currentStep + 1) / steps.length) * 100;

    const updateField = (field, value) => {
        setForm((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const toggleSkill = (skill) => {
        setForm((prev) => {
            const exists = prev.requiredSkills.includes(skill);
            return {
                ...prev,
                requiredSkills: exists
                    ? prev.requiredSkills.filter((item) => item !== skill)
                    : [...prev.requiredSkills, skill],
            };
        });
    };

    const addDataset = () => {
        const newDataset = {
            id: Date.now(),
            name: "",
            type: "",
            visibility: "Private",
        };

        setForm((prev) => ({
            ...prev,
            datasets: [...prev.datasets, newDataset],
        }));
    };

    const updateDataset = (id, field, value) => {
        setForm((prev) => ({
            ...prev,
            datasets: prev.datasets.map((item) =>
                item.id === id ? { ...item, [field]: value } : item
            ),
        }));
    };

    const removeDataset = (id) => {
        setForm((prev) => ({
            ...prev,
            datasets: prev.datasets.filter((item) => item.id !== id),
        }));
    };

    const addMilestone = () => {
        const newMilestone = {
            id: Date.now(),
            title: "",
            date: "",
        };

        setForm((prev) => ({
            ...prev,
            milestones: [...prev.milestones, newMilestone],
        }));
    };

    const updateMilestone = (id, field, value) => {
        setForm((prev) => ({
            ...prev,
            milestones: prev.milestones.map((item) =>
                item.id === id ? { ...item, [field]: value } : item
            ),
        }));
    };

    const removeMilestone = (id) => {
        setForm((prev) => ({
            ...prev,
            milestones: prev.milestones.filter((item) => item.id !== id),
        }));
    };

    const buildPayload = () => ({
        competition_name: form.competitionName,
        task_type: form.taskType,
        description: form.description,
        start_date: form.startDate || null,
        end_date: form.endDate || null,
        prize_pool: form.prizePool === "" ? null : Number(form.prizePool),

        primary_metric: form.primaryMetric || null,
        secondary_metric: form.secondaryMetric || null,

        max_teams: form.maxTeams === "" ? null : Number(form.maxTeams),
        min_members: form.minMembers === "" ? null : Number(form.minMembers),
        max_members: form.maxMembers === "" ? null : Number(form.maxMembers),
        merge_deadline: form.mergeDeadline || null,
        required_skills: form.requiredSkills,
        max_submissions_per_day:
            form.maxSubmissionsPerDay === ""
                ? null
                : Number(form.maxSubmissionsPerDay),
        allow_external_data: form.allowExternalData,
        allow_pretrained_models: form.allowPretrainedModels,
        require_code_sharing: form.requireCodeSharing,
        additional_rules: form.additionalRules || null,

        complexity_level: form.complexityLevel,

        datasets: form.datasets,
        milestones: form.milestones,
        validation_date: form.validationDate || null,
        freeze_date: form.freezeDate || null,
    });

    const saveDraft = async () => {
        try {
            setSubmitting(true);

            const token = localStorage.getItem("token");

            if (!token) {
                alert("You must login first.");
                navigate("/login");
                return;
            }

            const res = await fetch("http://127.0.0.1:8000/competitions/draft", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(buildPayload()),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    typeof data.detail === "string"
                        ? data.detail
                        : JSON.stringify(data.detail || data, null, 2)
                );
            }

            alert("Draft saved successfully");
        } catch (error) {
            console.error(error);
            alert(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const createCompetition = async () => {
        if (!form.competitionName.trim()) {
            alert("Competition Name is required.");
            setCurrentStep(0);
            return;
        }

        if (!form.taskType) {
            alert("Task Type is required.");
            setCurrentStep(0);
            return;
        }

        if (!form.description.trim()) {
            alert("Description is required.");
            setCurrentStep(0);
            return;
        }

        if (!form.startDate) {
            alert("Start Date is required.");
            setCurrentStep(0);
            return;
        }

        if (!form.endDate) {
            alert("End Date is required.");
            setCurrentStep(0);
            return;
        }

        if (new Date(form.endDate) < new Date(form.startDate)) {
            alert("End Date must be after Start Date.");
            setCurrentStep(0);
            return;
        }

        if (!form.primaryMetric) {
            alert("Primary Metric is required.");
            setCurrentStep(1);
            return;
        }

        if (form.prizePool !== "" && Number(form.prizePool) < 0) {
            alert("Prize Pool cannot be negative.");
            setCurrentStep(0);
            return;
        }

        if (
            form.minMembers !== "" &&
            form.maxMembers !== "" &&
            Number(form.minMembers) > Number(form.maxMembers)
        ) {
            alert("Min Team Members cannot be greater than Max Team Members.");
            setCurrentStep(2);
            return;
        }

        if (
            form.maxSubmissionsPerDay !== "" &&
            Number(form.maxSubmissionsPerDay) <= 0
        ) {
            alert("Maximum Submissions Per Day must be greater than 0.");
            setCurrentStep(2);
            return;
        }

        try {
            setSubmitting(true);

            const token = localStorage.getItem("token");

            if (!token) {
                alert("You must login first.");
                navigate("/login");
                return;
            }

            const res = await fetch("http://127.0.0.1:8000/competitions/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(buildPayload()),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    typeof data.detail === "string"
                        ? data.detail
                        : JSON.stringify(data.detail || data, null, 2)
                );
            }

            alert("Competition created successfully");
            navigate("/competitions", { state: { refreshAll: true } });
        } catch (error) {
            console.error(error);
            alert(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep((prev) => prev + 1);
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep((prev) => prev - 1);
        }
    };

    const renderBasicInfo = () => (
        <div className="create-card">
            <div className="create-section">
                <label>Competition Name</label>
                <input
                    type="text"
                    placeholder="e.g., Semantic Drift v4.2"
                    value={form.competitionName}
                    onChange={(e) => updateField("competitionName", e.target.value)}
                />
            </div>

            <div className="create-section">
                <label>Task Type</label>
                <select
                    value={form.taskType}
                    onChange={(e) => updateField("taskType", e.target.value)}
                >
                    <option value="">Select task type</option>
                    {taskTypes.map((task) => (
                        <option key={task} value={task}>
                            {task}
                        </option>
                    ))}
                </select>
            </div>

            <div className="create-section">
                <label>Description</label>
                <textarea
                    rows="3"
                    placeholder="Detect subtle shifts in contextual meaning across long-form legal documents..."
                    value={form.description}
                    onChange={(e) => updateField("description", e.target.value)}
                />
            </div>

            <div className="create-two-col">
                <div className="create-section">
                    <label>Start Date</label>
                    <input
                        type="date"
                        value={form.startDate}
                        onChange={(e) => updateField("startDate", e.target.value)}
                    />
                </div>

                <div className="create-section">
                    <label>End Date</label>
                    <input
                        type="date"
                        value={form.endDate}
                        onChange={(e) => updateField("endDate", e.target.value)}
                    />
                </div>
            </div>

            <div className="create-section">
                <label>Prize Pool (USD)</label>
                <input
                    type="number"
                    placeholder="e.g., 12500"
                    value={form.prizePool}
                    onChange={(e) => updateField("prizePool", e.target.value)}
                />
            </div>
        </div>
    );

    const renderEvaluation = () => (
        <div className="create-card">
            <h3 className="create-card-title">Evaluation Metrics</h3>
            <p className="create-card-subtitle">
                Define how submissions will be evaluated and ranked
            </p>

            <div className="create-section">
                <label>Primary Metric</label>
                <select
                    value={form.primaryMetric}
                    onChange={(e) => updateField("primaryMetric", e.target.value)}
                >
                    <option value="">Select primary metric</option>
                    {primaryMetrics.map((metric) => (
                        <option key={metric} value={metric}>
                            {metric}
                        </option>
                    ))}
                </select>
                <small>Main metric used for leaderboard ranking</small>
            </div>

            <div className="create-section">
                <label>Secondary Metric (Optional)</label>
                <select
                    value={form.secondaryMetric}
                    onChange={(e) => updateField("secondaryMetric", e.target.value)}
                >
                    <option value="">Select secondary metric</option>
                    {primaryMetrics.map((metric) => (
                        <option key={metric} value={metric}>
                            {metric}
                        </option>
                    ))}
                </select>
                <small>Additional metric for comparison (tie-breaker)</small>
            </div>

            <div className="metric-preview">
                <div>
                    <h4>Metric Preview</h4>
                    <p>Primary: {form.primaryMetric || "Not selected"}</p>
                </div>
                <span className="metric-badge">Primary</span>
            </div>
        </div>
    );

    const renderRules = () => (
        <div className="create-card">
            <h3 className="create-card-title">Competition Rules & Requirements</h3>
            <p className="create-card-subtitle">
                Define team structure, participant requirements, and submission rules
            </p>

            <div className="inner-panel">
                <h4>Team Configuration</h4>

                <div className="create-three-col">
                    <div className="create-section">
                        <label>Maximum Number of Teams</label>
                        <input
                            type="number"
                            placeholder="e.g., 100 (0 for unlimited)"
                            value={form.maxTeams}
                            onChange={(e) => updateField("maxTeams", e.target.value)}
                        />
                        <small>Set to 0 for unlimited teams</small>
                    </div>

                    <div className="create-section">
                        <label>Min Team Members</label>
                        <input
                            type="number"
                            placeholder="e.g., 1"
                            value={form.minMembers}
                            onChange={(e) => updateField("minMembers", e.target.value)}
                        />
                    </div>

                    <div className="create-section">
                        <label>Max Team Members</label>
                        <input
                            type="number"
                            placeholder="e.g., 5"
                            value={form.maxMembers}
                            onChange={(e) => updateField("maxMembers", e.target.value)}
                        />
                    </div>
                </div>

                <div className="create-section">
                    <label>Team Merger Deadline</label>
                    <input
                        type="date"
                        value={form.mergeDeadline}
                        onChange={(e) => updateField("mergeDeadline", e.target.value)}
                    />
                    <small>Last date when teams can merge together</small>
                </div>
            </div>

            <div className="create-section">
                <label>Required Skills</label>
                <small>Select the skills participants should have</small>
                <div className="skills-grid">
                    {skillsList.map((skill) => (
                        <label key={skill} className="checkbox-row">
                            <input
                                type="checkbox"
                                checked={form.requiredSkills.includes(skill)}
                                onChange={() => toggleSkill(skill)}
                            />
                            <span>{skill}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="inner-panel">
                <h4>Submission Rules</h4>

                <div className="create-section">
                    <label>Maximum Submissions Per Day</label>
                    <input
                        type="number"
                        placeholder="e.g., 5"
                        value={form.maxSubmissionsPerDay}
                        onChange={(e) =>
                            updateField("maxSubmissionsPerDay", e.target.value)
                        }
                    />
                    <small>Limit daily submissions to prevent overfitting</small>
                </div>

                <div className="toggle-row">
                    <div>
                        <strong>Allow External Data</strong>
                        <p>Can participants use datasets not provided by organizers?</p>
                    </div>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={form.allowExternalData}
                            onChange={(e) =>
                                updateField("allowExternalData", e.target.checked)
                            }
                        />
                        <span className="slider"></span>
                    </label>
                </div>

                <div className="toggle-row">
                    <div>
                        <strong>Allow Pre-trained Models</strong>
                        <p>Can participants use pre-trained models (e.g., BERT, GPT)?</p>
                    </div>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={form.allowPretrainedModels}
                            onChange={(e) =>
                                updateField("allowPretrainedModels", e.target.checked)
                            }
                        />
                        <span className="slider"></span>
                    </label>
                </div>

                <div className="toggle-row">
                    <div>
                        <strong>Require Code Sharing</strong>
                        <p>Must winners share their code and solution?</p>
                    </div>
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={form.requireCodeSharing}
                            onChange={(e) =>
                                updateField("requireCodeSharing", e.target.checked)
                            }
                        />
                        <span className="slider"></span>
                    </label>
                </div>
            </div>

            <div className="create-section">
                <label>Additional Rules & Guidelines</label>
                <textarea
                    rows="3"
                    placeholder="Specify any additional competition rules, ethical guidelines, or terms and conditions..."
                    value={form.additionalRules}
                    onChange={(e) => updateField("additionalRules", e.target.value)}
                />
                <small>
                    Include any other important rules like plagiarism policy, code of
                    conduct, prize distribution terms, etc.
                </small>
            </div>
        </div>
    );

    const renderComplexity = () => (
        <div className="create-card">
            <h3 className="create-card-title">Challenge Complexity</h3>
            <p className="create-card-subtitle">
                Set the difficulty level and technical requirements
            </p>

            <div className="create-section">
                <label>Complexity Level</label>
                <div className="complexity-list">
                    {complexityLevels.map((level, index) => (
                        <button
                            key={level.title}
                            type="button"
                            className={
                                form.complexityLevel === index
                                    ? "complexity-option active"
                                    : "complexity-option"
                            }
                            onClick={() => updateField("complexityLevel", index)}
                        >
                            <strong>{level.title}</strong>
                            <span>{level.description}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderDatasets = () => (
        <div className="create-card">
            <div className="section-header-row">
                <div>
                    <h3 className="create-card-title">Dataset Configuration</h3>
                    <p className="create-card-subtitle">
                        Define datasets and collection rules for participants
                    </p>
                </div>

                <button type="button" className="soft-action-btn" onClick={addDataset}>
                    + Add Dataset
                </button>
            </div>

            <div className="dataset-guidelines-box">
                <h4>Dataset Collection Guidelines</h4>
                <p>
                    Participants will collect data based on the rules and formats you
                    specify below. Test datasets marked as private will only be visible to
                    organizers for evaluation purposes.
                </p>
            </div>

            {form.datasets.length === 0 ? (
                <div className="empty-datasets-box">
                    <div className="upload-icon">⇪</div>
                    <h4>No datasets added</h4>
                    <p>Add dataset requirements for participant data collection</p>
                    <button type="button" className="dark-action-btn" onClick={addDataset}>
                        + Add Your First Dataset
                    </button>
                </div>
            ) : (
                <div className="dataset-list">
                    {form.datasets.map((dataset) => (
                        <div key={dataset.id} className="dataset-editor">
                            <div className="create-three-col">
                                <div className="create-section">
                                    <label>Dataset Name</label>
                                    <input
                                        type="text"
                                        value={dataset.name}
                                        placeholder="Dataset name"
                                        onChange={(e) =>
                                            updateDataset(dataset.id, "name", e.target.value)
                                        }
                                    />
                                </div>

                                <div className="create-section">
                                    <label>Type</label>
                                    <input
                                        type="text"
                                        value={dataset.type}
                                        placeholder="Text / Audio / Mixed"
                                        onChange={(e) =>
                                            updateDataset(dataset.id, "type", e.target.value)
                                        }
                                    />
                                </div>

                                <div className="create-section">
                                    <label>Visibility</label>
                                    <select
                                        value={dataset.visibility}
                                        onChange={(e) =>
                                            updateDataset(dataset.id, "visibility", e.target.value)
                                        }
                                    >
                                        <option value="Private">Private</option>
                                        <option value="Public">Public</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                type="button"
                                className="remove-btn"
                                onClick={() => removeDataset(dataset.id)}
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const renderMilestones = () => (
        <div className="create-card">
            <div className="section-header-row">
                <div>
                    <h3 className="create-card-title">Key Milestones</h3>
                    <p className="create-card-subtitle">
                        Set important dates and deadlines
                    </p>
                </div>

                <button
                    type="button"
                    className="soft-action-btn"
                    onClick={addMilestone}
                >
                    + Add Milestone
                </button>
            </div>

            <div className="milestone-grid">
                <div className="milestone-box">
                    <strong>Submission Open</strong>
                    <span>
                        {form.startDate ? form.startDate : "Set start date in Step 1"}
                    </span>
                </div>

                <div className="milestone-box">
                    <strong>Model Validation Phase</strong>
                    <input
                        type="date"
                        value={form.validationDate}
                        onChange={(e) => updateField("validationDate", e.target.value)}
                    />
                </div>

                <div className="milestone-box">
                    <strong>Final Leaderboard Freeze</strong>
                    <input
                        type="date"
                        value={form.freezeDate}
                        onChange={(e) => updateField("freezeDate", e.target.value)}
                    />
                </div>

                <div className="milestone-box">
                    <strong>Competition End</strong>
                    <span>{form.endDate ? form.endDate : "Set end date in Step 1"}</span>
                </div>
            </div>

            {form.milestones.length > 0 && (
                <div className="extra-milestones">
                    {form.milestones.map((item) => (
                        <div key={item.id} className="extra-milestone-item">
                            <input
                                type="text"
                                value={item.title}
                                placeholder="Milestone title"
                                onChange={(e) =>
                                    updateMilestone(item.id, "title", e.target.value)
                                }
                            />
                            <input
                                type="date"
                                value={item.date}
                                onChange={(e) =>
                                    updateMilestone(item.id, "date", e.target.value)
                                }
                            />
                            <button
                                type="button"
                                className="remove-btn"
                                onClick={() => removeMilestone(item.id)}
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const renderCurrentStep = () => {
        switch (currentStep) {
            case 0:
                return renderBasicInfo();
            case 1:
                return renderEvaluation();
            case 2:
                return renderRules();
            case 3:
                return renderComplexity();
            case 4:
                return renderDatasets();
            case 5:
                return renderMilestones();
            default:
                return null;
        }
    };

    return (
        <div className="create-page">
            <Sidebar />

            <div className="create-main">
                <div className="create-topbar">
                    <h1>Create New Competition</h1>
                    <div className="topbar-actions">
                        <button
                            type="button"
                            className="topbar-text-btn"
                            onClick={() => navigate("/competitions")}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="topbar-primary-btn"
                            onClick={saveDraft}
                            disabled={submitting}
                        >
                            Save Draft
                        </button>
                    </div>
                </div>

                <div className="create-content">
                    <div className="wizard-head">
                        <div className="wizard-title-row">
                            <h2>Create Competition</h2>
                            <span>Step {currentStep + 1} of 6</span>
                        </div>

                        <div className="wizard-progress">
                            <div
                                className="wizard-progress-fill"
                                style={{ width: `${progressPercent}%` }}
                            ></div>
                        </div>

                        <div className="wizard-tabs">
                            {steps.map((step, index) => (
                                <button
                                    key={step}
                                    type="button"
                                    className={currentStep === index ? "wizard-tab active" : "wizard-tab"}
                                    onClick={() => setCurrentStep(index)}
                                >
                                    {step}
                                </button>
                            ))}
                        </div>
                    </div>

                    {renderCurrentStep()}

                    <div className="wizard-footer">
                        <button
                            type="button"
                            className="footer-secondary-btn"
                            onClick={handlePrevious}
                            disabled={currentStep === 0 || submitting}
                        >
                            Previous
                        </button>

                        {currentStep < steps.length - 1 ? (
                            <button
                                type="button"
                                className="footer-primary-btn"
                                onClick={handleNext}
                                disabled={submitting}
                            >
                                Next Step
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="footer-success-btn"
                                onClick={createCompetition}
                                disabled={submitting}
                            >
                                {submitting ? "Creating..." : "Create Competition"}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CreateCompetition;