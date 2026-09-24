import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import HeroScene from '../components/three/HeroScene';
import KataCard from '../components/ui/KataCard';
import BunkaiCard from '../components/ui/BunkaiCard';
import { kataApi, bunkaiApi } from '../api/endpoints';
import './pages.css';

export default function Home() {
  const [kataList, setKataList] = useState([]);
  const [bunkaiList, setBunkaiList] = useState([]);

  useEffect(() => {
    kataApi.list().then((r) => setKataList(r.data.data.slice(0, 3)));
    bunkaiApi.list({ limit: 4 }).then((r) => setBunkaiList(r.data.data.items));
  }, []);

  return (
    <div>
      <section className="hero">
        <HeroScene />
        <div className="container hero-content">
          <motion.p
            className="hanko"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            分解探検家
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            Bunkai Explorer
          </motion.h1>
          <motion.p
            className="hero-lede"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            型の裏に隠された意味を探る — исследуйте скрытый смысл за движениями ката.
            Энциклопедия традиционных форм каратэ с разбором практического применения
            каждого движения: бункай.
          </motion.p>
          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            <Link to="/kata" className="btn btn-primary">Открыть каталог ката</Link>
            <Link to="/bunkai" className="btn">Смотреть бункай</Link>
          </motion.div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <h2>Популярные ката</h2>
          <Link to="/kata" className="section-link">Все ката →</Link>
        </div>
        <div className="card-grid">
          {kataList.map((k) => (
            <KataCard key={k.id} kata={k} />
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <h2>Последние бункай</h2>
          <Link to="/bunkai" className="section-link">Все бункай →</Link>
        </div>
        <div className="card-grid">
          {bunkaiList.map((b) => (
            <BunkaiCard key={b.id} bunkai={b} />
          ))}
        </div>
      </section>
    </div>
  );
}
