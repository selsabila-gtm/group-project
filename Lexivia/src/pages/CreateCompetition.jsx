import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "./CreateCompetition.css";
import DatasetSection from "./DatasetSection";
import { supabase } from "../config/supabase"; // adjust path if needed

/** Always returns a fresh, valid access token from Supabase session */
async function getFreshToken() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session?.access_token) return null;
    return data.session.access_token;
}

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

const PREDEFINED_SKILLS = [
    "Natural Language Processing",
    "Computer Vision",
    "PyTorch",
    "TensorFlow",
    "Transformer Architecture",
    "Vector Databases",
    "Python",
    "CUDA",
    "Rust",
    "Go",
    "Docker",
    "Kubernetes",
    "FastAPI",
    "React",
    "Named Entity Recognition",
    "Automatic Speech Recognition",
    "Text Classification",
    "Data Annotation",
    "MLOps",
    "Fine-tuning",
    "Prompt Engineering",
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

function safeArrayJson(value) {
    try {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function mapCompetitionToForm(c) {
    return {
        competitionName: c.title || "",
        taskType: c.task_type || c.category || "",
        description: c.description || "",
        startDate: c.start_date || "",
        endDate: c.end_date || "",
        prizePool: c.prize_pool ?? "",

        primaryMetric: c.primary_metric || "",
        secondaryMetric: c.secondary_metric || "",

        maxTeams: c.max_teams ?? "",
        minMembers: c.min_members ?? "",
        maxMembers: c.max_members ?? "",
        mergeDeadline: c.merge_deadline || "",
        requiredSkills: safeArrayJson(c.required_skills),
        maxSubmissionsPerDay: c.max_submissions_per_day ?? "",
        allowExternalData: c.allow_external_data ?? true,
        allowPretrainedModels: c.allow_pretrained_models ?? true,
        requireCodeSharing: c.require_code_sharing ?? false,
        additionalRules: c.additional_rules || "",

        complexityLevel: c.complexity_level ?? 0,

        datasets: [],
        milestones: safeArrayJson(c.milestones_json),
        validationDate: c.validation_date || "",
        freezeDate: c.freeze_date || "",
    };
}

function CreateCompetition({ editMode = false }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { competitionId } = useParams();

    const isEditMode = editMode || Boolean(competitionId);

    const [currentStep, setCurrentStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [loadingEditData, setLoadingEditData] = useState(isEditMode);
    const [form, setForm] = useState(initialForm);
    const [errors, setErrors] = useState({});
    const [skillsOpen, setSkillsOpen] = useState(false);

    // ✅ ADDED: real competition ID from draft save — this is what DatasetSection needs
    const [savedCompetitionId, setSavedCompetitionId] = useState(
        isEditMode ? competitionId : null
    );
    const [savingDraft, setSavingDraft] = useState(false);
    const [draftError, setDraftError] = useState(null);

    const progressPercent = ((currentStep + 1) / steps.length) * 100;

    useEffect(() => {
        if (!isEditMode) return;

        const competitionFromState = location.state?.competition;

        if (competitionFromState) {
            setForm(mapCompetitionToForm(competitionFromState));
            setLoadingEditData(false);
            return;
        }

        async function loadCompetitionForEdit() {
            try {
                const token = await getFreshToken();

                if (!token) {
                    navigate("/login");
                    return;
                }

                const res = await fetch(
                    `http://127.0.0.1:8000/competitions/${competitionId}`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.detail || "Could not load competition");
                }

                setForm(mapCompetitionToForm(data));
            } catch (error) {
                console.error(error);
                alert(error.message);
                navigate("/competitions");
            } finally {
                setLoadingEditData(false);
            }
        }

        loadCompetitionForEdit();
    }, [isEditMode, location.state, competitionId, navigate]);

    // ✅ ADDED: auto-save draft when user reaches step 4 so we get a real competition ID
    useEffect(() => {
        if (currentStep !== 4) return;   // only on Datasets step
        if (isEditMode) return;           // edit mode already has an ID
        if (savedCompetitionId) return;   // already saved

        async function saveDraft() {
            const token = await getFreshToken();
            if (!token) return;

            setSavingDraft(true);
            setDraftError(null);

            try {
                const r = await fetch("http://127.0.0.1:8000/competitions/draft", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(buildPayload()),
                });
                const data = await r.json();
                if (!r.ok) {
                    throw new Error(data.detail || `HTTP ${r.status}`);
                }
                // backend returns { competition_id: "..." }
                const id = data.id || data.competition_id;
                if (id) {
                    setSavedCompetitionId(id);
                } else {
                    setDraftError("Draft saved but no ID returned. Check backend response.");
                    console.error("Draft response missing id:", data);
                }
            } catch (err) {
                console.error("Draft save failed:", err);
                setDraftError(err.message || "Failed to save draft.");
            } finally {
                setSavingDraft(false);
            }
        }

        saveDraft();
    }, [currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

    const clearFieldError = (field) => {
        setErrors((prev) => {
            const copy = { ...prev };
            delete copy[field];
            return copy;
        });
    };

    const updateField = (field, value) => {
        setForm((prev) => ({
            ...prev,
            [field]: value,
        }));

        clearFieldError(field);
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

        clearFieldError(`datasetName-${id}`);
        clearFieldError(`datasetType-${id}`);
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

    const validateStep = (step = currentStep) => {
        const nextErrors = {};

        if (step === 0) {
            if (!form.competitionName.trim()) {
                nextErrors.competitionName = "Competition name is required.";
            }

            if (!form.taskType) {
                nextErrors.taskType = "Task type is required.";
            }

            if (!form.description.trim()) {
                nextErrors.description = "Description is required.";
            }

            if (
                form.startDate &&
                form.endDate &&
                new Date(form.endDate) < new Date(form.startDate)
            ) {
                nextErrors.endDate = "End date must be after start date.";
            }

            if (form.prizePool !== "" && Number(form.prizePool) < 0) {
                nextErrors.prizePool = "Prize pool cannot be negative.";
            }
        }

        if (step === 1) {
            if (!form.primaryMetric) {
                nextErrors.primaryMetric = "Primary metric is required.";
            }
        }

        if (step === 2) {
            if (form.maxTeams !== "" && Number(form.maxTeams) < 0) {
                nextErrors.maxTeams = "Maximum teams cannot be negative.";
            }

            if (form.minMembers !== "" && Number(form.minMembers) <= 0) {
                nextErrors.minMembers = "Minimum members must be greater than 0.";
            }

            if (form.maxMembers !== "" && Number(form.maxMembers) <= 0) {
                nextErrors.maxMembers = "Maximum members must be greater than 0.";
            }

            if (
                form.minMembers !== "" &&
                form.maxMembers !== "" &&
                Number(form.minMembers) > Number(form.maxMembers)
            ) {
                nextErrors.maxMembers = "Max members must be greater than min members.";
            }

            if (
                form.maxSubmissionsPerDay !== "" &&
                Number(form.maxSubmissionsPerDay) <= 0
            ) {
                nextErrors.maxSubmissionsPerDay =
                    "Max submissions per day must be greater than 0.";
            }

            if (
                form.mergeDeadline &&
                form.startDate &&
                new Date(form.mergeDeadline) < new Date(form.startDate)
            ) {
                nextErrors.mergeDeadline = "Merge deadline cannot be before start date.";
            }

            if (
                form.mergeDeadline &&
                form.endDate &&
                new Date(form.mergeDeadline) > new Date(form.endDate)
            ) {
                nextErrors.mergeDeadline = "Merge deadline cannot be after end date.";
            }
        }

        if (step === 4) {
            form.datasets.forEach((dataset, index) => {
                if (!dataset.name.trim()) {
                    nextErrors[`datasetName-${dataset.id}`] =
                        `Dataset ${index + 1} name is required.`;
                }

                if (!dataset.type.trim()) {
                    nextErrors[`datasetType-${dataset.id}`] =
                        `Dataset ${index + 1} type is required.`;
                }
            });
        }

        if (step === 5) {
            if (
                form.validationDate &&
                form.startDate &&
                new Date(form.validationDate) < new Date(form.startDate)
            ) {
                nextErrors.validationDate =
                    "Validation date cannot be before start date.";
            }

            if (
                form.validationDate &&
                form.endDate &&
                new Date(form.validationDate) > new Date(form.endDate)
            ) {
                nextErrors.validationDate =
                    "Validation date cannot be after competition end date.";
            }

            if (
                form.freezeDate &&
                form.startDate &&
                new Date(form.freezeDate) < new Date(form.startDate)
            ) {
                nextErrors.freezeDate = "Freeze date cannot be before start date.";
            }

            if (
                form.freezeDate &&
                form.validationDate &&
                new Date(form.freezeDate) < new Date(form.validationDate)
            ) {
                nextErrors.freezeDate = "Freeze date cannot be before validation date.";
            }

            if (
                form.freezeDate &&
                form.endDate &&
                new Date(form.freezeDate) > new Date(form.endDate)
            ) {
                nextErrors.freezeDate = "Freeze date cannot be after competition end date.";
            }
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
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

        milestones: form.milestones,
        validation_date: form.validationDate || null,
        freeze_date: form.freezeDate || null,
    });

    const saveDraft = async () => {
        if (isEditMode) return;

        try {
            setSubmitting(true);

            const token = await getFreshToken();

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

            const id = data.id || data.competition_id;
            if (id) setSavedCompetitionId(id);

            alert("Draft saved successfully");
        } catch (error) {
            console.error(error);
            alert(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const submitCompetition = async () => {
        for (let step = 0; step < steps.length; step++) {
            if (!validateStep(step)) {
                setCurrentStep(step);
                return;
            }
        }

        try {
            setSubmitting(true);

            const token = await getFreshToken();

            if (!token) {
                alert("You must login first.");
                navigate("/login");
                return;
            }

            // ✅ if draft was already saved, update it — avoids creating a duplicate
            const url = isEditMode
                ? `http://127.0.0.1:8000/competitions/${competitionId}/update`
                : savedCompetitionId
                    ? `http://127.0.0.1:8000/competitions/${savedCompetitionId}/update`
                    : "http://127.0.0.1:8000/competitions/create";

            const method = isEditMode || savedCompetitionId ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
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

            alert(
                isEditMode
                    ? "Competition updated successfully"
                    : "Competition created successfully"
            );

            if (isEditMode) {
                navigate(`/competitions/${competitionId}/organizer`, {
                    state: { refreshed: true },
                });
            } else {
                navigate("/competitions", { state: { refreshAll: true } });
            }
        } catch (error) {
            console.error(error);
            alert(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = () => {
        if (isEditMode) {
            navigate(`/competitions/${competitionId}/organizer`);
        } else {
            navigate("/competitions");
        }
    };

    const handleNext = () => {
        if (!validateStep(currentStep)) return;

        if (currentStep < steps.length - 1) {
            setCurrentStep((prev) => prev + 1);
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep((prev) => prev - 1);
        }
    };

    const ErrorMessage = ({ name }) => {
        if (!errors[name]) return null;
        return <span className="field-error">{errors[name]}</span>;
    };

    const renderBasicInfo = () => (
        <div className="create-card">
            <div className="create-section">
                <label>Competition Name <span className="required-star">*</span></label>
                <input
                    className={errors.competitionName ? "input-error" : ""}
                    type="text"
                    placeholder="e.g., Semantic Drift v4.2"
                    value={form.competitionName}
                    onChange={(e) => updateField("competitionName", e.target.value)}
                />
                <ErrorMessage name="competitionName" />
            </div>

            <div className="create-section">
                <label>Task Type <span className="required-star">*</span></label>
                <select
                    className={errors.taskType ? "input-error" : ""}
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
                <ErrorMessage name="taskType" />
            </div>

            <div className="create-section">
                <label>Description <span className="required-star">*</span></label>
                <textarea
                    className={errors.description ? "input-error" : ""}
                    rows="3"
                    placeholder="Describe the competition goal, task, and expected output..."
                    value={form.description}
                    onChange={(e) => updateField("description", e.target.value)}
                />
                <ErrorMessage name="description" />
            </div>

            <div className="create-two-col">
                <div className="create-section">
                    <label>Start Date</label>
                    <input
                        className={errors.startDate ? "input-error" : ""}
                        type="date"
                        value={form.startDate}
                        onChange={(e) => updateField("startDate", e.target.value)}
                    />
                    <ErrorMessage name="startDate" />
                </div>

                <div className="create-section">
                    <label>End Date</label>
                    <input
                        className={errors.endDate ? "input-error" : ""}
                        type="date"
                        value={form.endDate}
                        onChange={(e) => updateField("endDate", e.target.value)}
                    />
                    <ErrorMessage name="endDate" />
                </div>
            </div>

            <div className="create-section">
                <label>Prize Pool (USD)</label>
                <input
                    className={errors.prizePool ? "input-error" : ""}
                    type="number"
                    placeholder="e.g., 12500"
                    value={form.prizePool}
                    onChange={(e) => updateField("prizePool", e.target.value)}
                />
                <small>Optional. Leave empty if there is no prize.</small>
                <ErrorMessage name="prizePool" />
            </div>
        </div>
    );

    const renderEvaluation = () => (
        <div className="create-card">
            <h3 className="create-card-title">Evaluation Metrics</h3>
            <p className="create-card-subtitle">
                Define how submissions will be evaluated and ranked.
            </p>

            <div className="create-section">
                <label>Primary Metric <span className="required-star">*</span></label>
                <select
                    className={errors.primaryMetric ? "input-error" : ""}
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
                <small>Main metric used for leaderboard ranking.</small>
                <ErrorMessage name="primaryMetric" />
            </div>

            <div className="create-section">
                <label>Secondary Metric</label>
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
                <small>Optional tie-breaker metric.</small>
            </div>

            <div className="metric-preview">
                <div>
                    <h4>Metric Preview</h4>
                    <p>Primary: {form.primaryMetric || "Not selected"}</p>
                    <p>Secondary: {form.secondaryMetric || "Not selected"}</p>
                </div>
                <span className="metric-badge">Primary</span>
            </div>
        </div>
    );

    const renderRules = () => (
        <div className="create-card">
            <h3 className="create-card-title">Competition Rules & Requirements</h3>
            <p className="create-card-subtitle">
                Optional settings for team limits, skills, and submission rules.
            </p>

            <div className="inner-panel">
                <h4>Team Configuration</h4>

                <div className="create-three-col">
                    <div className="create-section">
                        <label>Maximum Number of Teams</label>
                        <input
                            className={errors.maxTeams ? "input-error" : ""}
                            type="number"
                            placeholder="e.g., 100"
                            value={form.maxTeams}
                            onChange={(e) => updateField("maxTeams", e.target.value)}
                        />
                        <small>Leave empty or set 0 for unlimited teams.</small>
                        <ErrorMessage name="maxTeams" />
                    </div>

                    <div className="create-section">
                        <label>Min Team Members</label>
                        <input
                            className={errors.minMembers ? "input-error" : ""}
                            type="number"
                            placeholder="e.g., 1"
                            value={form.minMembers}
                            onChange={(e) => updateField("minMembers", e.target.value)}
                        />
                        <ErrorMessage name="minMembers" />
                    </div>

                    <div className="create-section">
                        <label>Max Team Members</label>
                        <input
                            className={errors.maxMembers ? "input-error" : ""}
                            type="number"
                            placeholder="e.g., 5"
                            value={form.maxMembers}
                            onChange={(e) => updateField("maxMembers", e.target.value)}
                        />
                        <ErrorMessage name="maxMembers" />
                    </div>
                </div>

                <div className="create-section">
                    <label>Team Merger Deadline</label>
                    <input
                        className={errors.mergeDeadline ? "input-error" : ""}
                        type="date"
                        value={form.mergeDeadline}
                        onChange={(e) => updateField("mergeDeadline", e.target.value)}
                    />
                    <small>Optional. Must be between start and end date.</small>
                    <ErrorMessage name="mergeDeadline" />
                </div>
            </div>

            <div className="create-section">
                <label>Required Skills</label>
                <small>Optional. Pick skills from the predefined list.</small>

                <div className="skills-select">
                    <button
                        type="button"
                        className="skills-select-btn"
                        onClick={() => setSkillsOpen((prev) => !prev)}
                    >
                        {form.requiredSkills.length === 0
                            ? "Select required skills"
                            : `${form.requiredSkills.length} skill(s) selected`}
                        <span>⌄</span>
                    </button>

                    {skillsOpen && (
                        <div className="skills-dropdown">
                            {PREDEFINED_SKILLS.map((skill) => {
                                const selected = form.requiredSkills.includes(skill);

                                return (
                                    <button
                                        key={skill}
                                        type="button"
                                        className={selected ? "skill-option selected" : "skill-option"}
                                        onClick={() => toggleSkill(skill)}
                                    >
                                        <span>{skill}</span>
                                        {selected && <strong>✓</strong>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {form.requiredSkills.length > 0 && (
                    <div className="selected-skills">
                        {form.requiredSkills.map((skill) => (
                            <button
                                key={skill}
                                type="button"
                                onClick={() => toggleSkill(skill)}
                            >
                                {skill} ×
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="inner-panel">
                <h4>Submission Rules</h4>

                <div className="create-section">
                    <label>Maximum Submissions Per Day</label>
                    <input
                        className={errors.maxSubmissionsPerDay ? "input-error" : ""}
                        type="number"
                        placeholder="e.g., 5"
                        value={form.maxSubmissionsPerDay}
                        onChange={(e) =>
                            updateField("maxSubmissionsPerDay", e.target.value)
                        }
                    />
                    <small>Optional. Leave empty for no daily limit.</small>
                    <ErrorMessage name="maxSubmissionsPerDay" />
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
                        <p>Can participants use pre-trained models such as BERT or GPT?</p>
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
                    placeholder="Specify extra rules, ethics requirements, prize distribution terms..."
                    value={form.additionalRules}
                    onChange={(e) => updateField("additionalRules", e.target.value)}
                />
            </div>
        </div>
    );

    const renderComplexity = () => (
        <div className="create-card">
            <h3 className="create-card-title">Challenge Complexity</h3>
            <p className="create-card-subtitle">
                Choose the difficulty level of this competition.
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

    // ✅ ADDED: replaces old inline case 4 — shows spinner/error while saving draft
    const renderDatasets = () => {
        if (savingDraft) {
            return (
                <div className="create-card" style={{ textAlign: "center", padding: "48px 24px" }}>
                    <p style={{ color: "#6b7280", fontSize: 14 }}>
                        ⏳ Saving draft to enable dataset upload…
                    </p>
                </div>
            );
        }

        if (draftError) {
            return (
                <div className="create-card" style={{ textAlign: "center", padding: "48px 24px" }}>
                    <p style={{ color: "#ef4444", fontSize: 14, marginBottom: 12 }}>
                        ⚠️ Could not save draft: {draftError}
                    </p>
                    <button
                        type="button"
                        className="footer-primary-btn"
                        onClick={() => {
                            setDraftError(null);
                            setSavedCompetitionId(null); // reset so useEffect re-fires
                        }}
                    >
                        Retry
                    </button>
                </div>
            );
        }

        return (
            <DatasetSection
                competitionId={savedCompetitionId}
                datasets={form.datasets}
                errors={errors}
                addDataset={addDataset}
                updateDataset={updateDataset}
                removeDataset={removeDataset}
            />
        );
    };

    const renderMilestones = () => (
        <div className="create-card">
            <div className="section-header-row">
                <div>
                    <h3 className="create-card-title">Key Milestones</h3>
                    <p className="create-card-subtitle">
                        Optional. Add validation and leaderboard dates.
                    </p>
                </div>

                <button type="button" className="soft-action-btn" onClick={addMilestone}>
                    + Add Milestone
                </button>
            </div>

            <div className="milestone-grid">
                <div className="milestone-box">
                    <strong>Submission Open</strong>
                    <span>{form.startDate ? form.startDate : "Set start date in Step 1"}</span>
                </div>

                <div className="milestone-box">
                    <strong>Model Validation Phase</strong>
                    <input
                        className={errors.validationDate ? "input-error" : ""}
                        type="date"
                        value={form.validationDate}
                        onChange={(e) => updateField("validationDate", e.target.value)}
                    />
                    <ErrorMessage name="validationDate" />
                </div>

                <div className="milestone-box">
                    <strong>Final Leaderboard Freeze</strong>
                    <input
                        className={errors.freezeDate ? "input-error" : ""}
                        type="date"
                        value={form.freezeDate}
                        onChange={(e) => updateField("freezeDate", e.target.value)}
                    />
                    <ErrorMessage name="freezeDate" />
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
                return renderDatasets(); // ✅ now uses renderDatasets()
            case 5:
                return renderMilestones();
            default:
                return null;
        }
    };

    if (loadingEditData) {
        return (
            <div className="create-page">
                <Sidebar />
                <div className="create-main">
                    <div className="create-content">
                        <div className="create-card">
                            <h3>Loading competition data...</h3>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="create-page">
            <Sidebar />

            <div className="create-main">
                <div className="create-topbar">
                    <h1>{isEditMode ? "Edit Competition" : "Create New Competition"}</h1>

                    <div className="topbar-actions">
                        <button
                            type="button"
                            className="topbar-text-btn"
                            onClick={handleCancel}
                        >
                            Cancel
                        </button>
                    </div>
                </div>

                <div className="create-content">
                    <div className="wizard-head">
                        <div className="wizard-title-row">
                            <h2>{isEditMode ? "Update Competition" : "Create Competition"}</h2>
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
                                    className={
                                        currentStep === index ? "wizard-tab active" : "wizard-tab"
                                    }
                                    onClick={() => {
                                        if (index <= currentStep) {
                                            setCurrentStep(index);
                                            return;
                                        }

                                        if (validateStep(currentStep)) {
                                            setCurrentStep(index);
                                        }
                                    }}
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
                                onClick={submitCompetition}
                                disabled={submitting}
                            >
                                {submitting
                                    ? isEditMode
                                        ? "Updating..."
                                        : "Creating..."
                                    : isEditMode
                                        ? "Update Competition"
                                        : "Create Competition"}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CreateCompetition;
