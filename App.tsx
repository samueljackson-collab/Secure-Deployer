import React, { useMemo, useState } from "react";

/**
 * Generated from: VISUAL_SPEC_FULL.json
 * Spec file: portfolio_app_spec.json
 *
 * Usage:
 *   - Drop into a Vite React + TS project as src/App.tsx
 *   - Ensure Tailwind is configured (classes used below). If not using Tailwind,
 *     replace className strings with your styling approach.
 */

type Project = {
  id: string;
  name: string;
  domain: string;
  status: string;
  difficulty: string;
  summary: string;
  tags: string[];
  artifacts: Array<{ type: string; label: string }>;
};

type AppData = {
  domains: string[];
  projects: Project[];
};

const DATA: AppData = {
  domains: ["General", "P", "SITE"],
  projects: [
    {
      id: "00",
      name: "Homelab & Secure Network Build",
      domain: "General",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
    {
      id: "P01",
      name: "AWS Infra Automation (CloudFormation)",
      domain: "P",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
    {
      id: "P02",
      name: "IAM Security Hardening",
      domain: "P",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
    {
      id: "P03",
      name: "Hybrid Network Connectivity Lab",
      domain: "P",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
    {
      id: "P04",
      name: "Operational Monitoring & Automation",
      domain: "P",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
    {
      id: "P05",
      name: "Mobile App Manual Testing",
      domain: "P",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
    {
      id: "P06",
      name: "Web App Automated Testing",
      domain: "P",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
    {
      id: "P07",
      name: "International Roaming Test Simulation",
      domain: "P",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
    {
      id: "P08",
      name: "Backend API Testing",
      domain: "P",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
    {
      id: "P09",
      name: "Cloud-Native POC Deployment",
      domain: "P",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
    {
      id: "P10",
      name: "Scalable Multi-Region Architecture",
      domain: "P",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
    {
      id: "P11",
      name: "API Gateway & Serverless Integration",
      domain: "P",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
    {
      id: "P12",
      name: "Data Pipeline Architecture",
      domain: "P",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
    {
      id: "P13",
      name: "High Availability Web App",
      domain: "P",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
    {
      id: "P14",
      name: "Disaster Recovery Design",
      domain: "P",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
    {
      id: "P15",
      name: "Cloud Cost Optimization Lab",
      domain: "P",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
    {
      id: "P16",
      name: "Zero-Trust Cloud Architecture",
      domain: "P",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
    {
      id: "P17",
      name: "Terraform Multi-Cloud Deployment",
      domain: "P",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
    {
      id: "P18",
      name: "CI/CD Pipeline with Kubernetes",
      domain: "P",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
    {
      id: "P19",
      name: "Cloud Security Automation",
      domain: "P",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
    {
      id: "P20",
      name: "Observability Engineering",
      domain: "P",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
    {
      id: "SITE",
      name: "Portfolio Site (Static)",
      domain: "SITE",
      status: "Planned",
      difficulty: "Intermediate",
      summary: "Portfolio project definition from the master visual spec.",
      tags: [],
      artifacts: [],
    },
  ],
};

const STATUS_OPTIONS = ["All", "Planned", "In Progress", "Complete"];
const DIFFICULTY_OPTIONS = ["All", "Beginner", "Intermediate", "Advanced"];

function normalize(s: string): string {
  return (s ?? "").toLowerCase().trim();
}

function pillClass(active: boolean): string {
  return [
    "inline-flex items-center rounded-full border px-3 py-1 text-sm transition",
    active
      ? "bg-gray-900 text-white border-gray-900"
      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
  ].join(" ");
}

function selectClass(): string {
  return "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900";
}

function inputClass(): string {
  return "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900";
}

function cardClass(): string {
  return "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition";
}

function modalBackdropClass(): string {
  return "fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50";
}

function modalClass(): string {
  return "w-full max-w-3xl rounded-2xl bg-white shadow-xl border border-gray-200";
}

function sectionTitleClass(): string {
  return "text-sm font-semibold text-gray-900";
}

function smallMuted(): string {
  return "text-sm text-gray-600";
}

export default function App() {
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("All");
  const [status, setStatus] = useState("All");
  const [difficulty, setDifficulty] = useState("All");
  const [sort, setSort] = useState<"name_asc" | "name_desc" | "domain_asc" | "status_asc">("name_asc");
  const [showOnlyWithArtifacts, setShowOnlyWithArtifacts] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const domainOptions = useMemo(() => ["All", ...DATA.domains], []);
  const projectById = useMemo(() => new Map(DATA.projects.map((p) => [p.id, p])), []);
  const selectedProject = selectedProjectId ? projectById.get(selectedProjectId) : undefined;

  const filtered = useMemo(() => {
    const q = normalize(search);

    const base = DATA.projects.filter((p) => {
      const matchesSearch =
        !q ||
        normalize(p.name).includes(q) ||
        normalize(p.summary).includes(q) ||
        p.tags.some((t) => normalize(t).includes(q)) ||
        normalize(p.id).includes(q);

      const matchesDomain = domain === "All" || p.domain === domain;
      const matchesStatus = status === "All" || p.status === status;
      const matchesDifficulty = difficulty === "All" || p.difficulty === difficulty;
      const matchesArtifacts = !showOnlyWithArtifacts || (p.artifacts?.length ?? 0) > 0;

      return matchesSearch && matchesDomain && matchesStatus && matchesDifficulty && matchesArtifacts;
    });

    const sorted = [...base].sort((a, b) => {
      switch (sort) {
        case "name_desc":
          return a.name.localeCompare(b.name) * -1;
        case "domain_asc":
          return a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name);
        case "status_asc":
          return a.status.localeCompare(b.status) || a.name.localeCompare(b.name);
        case "name_asc":
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return sorted;
  }, [search, domain, status, difficulty, sort, showOnlyWithArtifacts]);

  const stats = useMemo(() => {
    const total = DATA.projects.length;
    const complete = DATA.projects.filter((p) => normalize(p.status) === "complete").length;
    const inProgress = DATA.projects.filter((p) => normalize(p.status) === "in progress").length;
    const planned = DATA.projects.filter((p) => normalize(p.status) === "planned").length;

    return { total, complete, inProgress, planned, showing: filtered.length };
  }, [filtered.length]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-xl font-semibold">Portfolio Navigator</div>
            <div className="text-sm text-gray-600">
              Browse projects, filter by domain, and open details.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Data source:</span>
            <span className="text-xs font-mono rounded-md bg-gray-100 px-2 py-1 border border-gray-200">
              VISUAL_SPEC_FULL.json
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-4 xl:col-span-3">
          <div className={cardClass()}>
            <div className="space-y-4">
              <div>
                <div className={sectionTitleClass()}>Search</div>
                <div className="mt-2">
                  <input
                    className={inputClass()}
                    placeholder="Search by name, id, summary, or tags..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div className={sectionTitleClass()}>Domain</div>
                <div className="mt-2">
                  <select className={selectClass()} value={domain} onChange={(e) => setDomain(e.target.value)}>
                    {domainOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className={sectionTitleClass()}>Status</div>
                <div className="mt-2">
                  <select className={selectClass()} value={status} onChange={(e) => setStatus(e.target.value)}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className={sectionTitleClass()}>Difficulty</div>
                <div className="mt-2">
                  <select className={selectClass()} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                    {DIFFICULTY_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className={sectionTitleClass()}>Sort</div>
                <div className="mt-2">
                  <select className={selectClass()} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                    <option value="name_asc">Name (A → Z)</option>
                    <option value="name_desc">Name (Z → A)</option>
                    <option value="domain_asc">Domain</option>
                    <option value="status_asc">Status</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={showOnlyWithArtifacts}
                    onChange={(e) => setShowOnlyWithArtifacts(e.target.checked)}
                  />
                  Only projects with artifacts
                </label>

                <button
                  className={pillClass(false)}
                  onClick={() => {
                    setSearch("");
                    setDomain("All");
                    setStatus("All");
                    setDifficulty("All");
                    setSort("name_asc");
                    setShowOnlyWithArtifacts(false);
                  }}
                >
                  Reset
                </button>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Total" value={stats.total} />
                  <Stat label="Showing" value={stats.showing} />
                  <Stat label="Complete" value={stats.complete} />
                  <Stat label="In Progress" value={stats.inProgress} />
                </div>
                <div className="mt-3 text-xs text-gray-500">Planned: {stats.planned}</div>
              </div>
            </div>
          </div>
        </aside>

        <section className="lg:col-span-8 xl:col-span-9">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <ProjectCard key={p.id} project={p} onOpen={() => setSelectedProjectId(p.id)} />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <div className="text-lg font-semibold">No matches</div>
              <div className="mt-1 text-sm text-gray-600">Adjust filters or search terms and try again.</div>
            </div>
          )}
        </section>
      </main>

      {selectedProject && (
        <div className={modalBackdropClass()} onClick={() => setSelectedProjectId(null)} role="dialog" aria-modal="true">
          <div className={modalClass()} onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200 flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-gray-500 font-mono">{selectedProject.id}</div>
                <div className="text-xl font-semibold">{selectedProject.name}</div>
                <div className="mt-1 text-sm text-gray-600">{selectedProject.summary}</div>
              </div>

              <button className={pillClass(false)} onClick={() => setSelectedProjectId(null)}>
                Close
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-5 space-y-4">
                <div className={cardClass()}>
                  <div className={sectionTitleClass()}>Metadata</div>
                  <div className="mt-2 space-y-2">
                    <MetaRow label="Domain" value={selectedProject.domain} />
                    <MetaRow label="Status" value={selectedProject.status} />
                    <MetaRow label="Difficulty" value={selectedProject.difficulty} />
                  </div>
                </div>

                <div className={cardClass()}>
                  <div className={sectionTitleClass()}>Tags</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(selectedProject.tags?.length ? selectedProject.tags : ["—"]).map((t) => (
                      <span
                        key={t}
                        className="text-xs rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-gray-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="md:col-span-7 space-y-4">
                <div className={cardClass()}>
                  <div className={sectionTitleClass()}>Artifacts</div>
                  <div className="mt-2">
                    {(selectedProject.artifacts?.length ?? 0) === 0 ? (
                      <div className={smallMuted()}>No artifacts listed for this project yet.</div>
                    ) : (
                      <ul className="list-disc pl-5 space-y-1">
                        {selectedProject.artifacts.map((a, idx) => (
                          <li key={idx} className="text-sm text-gray-700">
                            <span className="font-semibold">{a.type}:</span> {a.label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm text-gray-700">
                    Next step: connect this UI to your master JSON export and map artifacts to real files/URLs. If you
                    want, I can generate:
                  </div>
                  <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 space-y-1">
                    <li>Project detail pages (routes) instead of a modal</li>
                    <li>Markdown/README renderer for each project</li>
                    <li>Evidence gallery (screenshots/logs) and file-linking conventions</li>
                    <li>Build-time JSON validation and schema enforcement</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-gray-500">
          Generated TSX + JSON spec. You can refactor DATA into a separate file and fetch it at runtime if preferred.
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{value || "—"}</div>
    </div>
  );
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const tagPreview = (project.tags ?? []).slice(0, 3);
  return (
    <button className={cardClass() + " text-left"} onClick={onOpen}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-gray-500 font-mono">{project.id}</div>
          <div className="mt-1 text-base font-semibold">{project.name}</div>
        </div>
        <span className="text-xs rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-gray-700">
          {project.status}
        </span>
      </div>

      <div className="mt-2 text-sm text-gray-600 line-clamp-3">{project.summary}</div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="text-xs rounded-full border border-gray-200 bg-white px-2 py-1 text-gray-700">
          {project.domain}
        </span>
        <span className="text-xs rounded-full border border-gray-200 bg-white px-2 py-1 text-gray-700">
          {project.difficulty}
        </span>
        {tagPreview.map((t) => (
          <span key={t} className="text-xs rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-gray-700">
            {t}
          </span>
        ))}
      </div>

      <div className="mt-3 text-xs text-gray-500">Artifacts: {project.artifacts?.length ?? 0}</div>
    </button>
  );
}
