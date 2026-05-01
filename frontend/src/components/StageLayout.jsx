import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const stages = [
  { path: '/', label: 'Upload', showIndex: true },
  { path: '/visualizations', label: 'Visualizations', showIndex: true },
  { path: '/data-quality', label: 'Data Quality', showIndex: true },
  { path: '/feature-engineering', label: 'Feature Engineering', showIndex: true },
  { path: '/dataset-live', label: 'Dataset Live', showIndex: false },
  { path: '/model-training', label: 'Model Training', showIndex: true },
  { path: '/insights', label: 'Insights', showIndex: true },
];

export default function StageLayout({ children }) {
  const location = useLocation();

  return (
    <div className="min-h-screen text-white app-bg">
      <div className="app-grain" />

      <header className="sticky top-0 z-40 backdrop-blur-md border-b border-white/10 bg-slate-900/70">
        <div className="max-w-7xl mx-auto px-5 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-[0.18em] text-sky-300">DATAMIND</h1>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Agentic Analytics Studio</p>
          </div>

          <nav className="flex gap-2 flex-wrap">
            {stages.map((stage, index) => {
              const isActive = location.pathname === stage.path;
              return (
                <Link
                  key={stage.path}
                  to={stage.path}
                  className={`stage-pill ${isActive ? 'stage-pill-active' : 'stage-pill-idle'}`}
                >
                  {stage.showIndex !== false && <span className="text-slate-400 text-xs mr-2">0{index + 1}</span>}
                  {stage.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="max-w-7xl mx-auto px-5 py-8 md:py-10"
      >
        {children}
      </motion.main>
    </div>
  );
}
