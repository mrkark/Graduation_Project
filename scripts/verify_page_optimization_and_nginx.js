/**
 * verify_page_optimization_and_nginx.js
 * Комплексный аудит оптимизации загрузки страниц («1-й экран») и конфигурации Nginx
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const CLIENT_DIR = path.join(ROOT_DIR, 'client');
const NGINX_DIR = path.join(ROOT_DIR, 'nginx');

const auditResults = {
  timestamp: new Date().toISOString(),
  checks: [],
  allPassed: true,
};

function recordCheck(name, passed, details) {
  auditResults.checks.push({ name, passed, details });
  const icon = passed ? '✔' : '❌';
  console.log(`${icon} [${name}]: ${details}`);
  if (!passed) auditResults.allPassed = false;
}

console.log('================================================================');
console.log('🥋 BUNKAI EXPLORER — АУДИТ ОПТИМИЗАЦИИ 1-ГО ЭКРАНА И NGINX');
console.log('================================================================\n');

// 1. Проверка компонента LazySection
const lazySectionPath = path.join(CLIENT_DIR, 'src', 'components', 'ui', 'LazySection.jsx');
const hasLazySection = fs.existsSync(lazySectionPath);
recordCheck(
  'LazySection Component',
  hasLazySection,
  hasLazySection ? 'Компонент отложенной догрузки LazySection создан' : 'Файл отсутствует'
);

// 2. Проверка оптимизации HomePage (1-й экран + LazySection)
const homePagePath = path.join(CLIENT_DIR, 'src', 'pages', 'HomePage.jsx');
const homeContent = fs.readFileSync(homePagePath, 'utf-8');
const homeHasLazy = homeContent.includes('<LazySection') && homeContent.includes("from '../components/ui/LazySection'");
const homeHasEagerHero = homeContent.includes('fetchPriority="high"') && homeContent.includes('loading="eager"');
recordCheck(
  'HomePage Above-The-Fold',
  homeHasLazy && homeHasEagerHero,
  `LazySection: ${homeHasLazy}, Eager Hero LCP image: ${homeHasEagerHero}`
);

// 3. Проверка оптимизации KataListPage (павильоны + ленивые картинки)
const kataListPath = path.join(CLIENT_DIR, 'src', 'pages', 'KataListPage.jsx');
const kataContent = fs.readFileSync(kataListPath, 'utf-8');
const kataHasLazy = kataContent.includes('<LazySection') && kataContent.includes('loading="lazy"');
const kataHasSpotlightEager = kataContent.includes('fetchPriority="high"');
recordCheck(
  'KataListPage 1st Screen & Pavilions',
  kataHasLazy && kataHasSpotlightEager,
  `Павильоны LazySection: ${kataHasLazy}, Spotlight eager: ${kataHasSpotlightEager}`
);

// 4. Проверка отложенной загрузки Three.js компонентов и устранения useGLTF.preload
const lowpolyPath = path.join(CLIENT_DIR, 'src', 'three', 'KaratekaLowpolyModel.jsx');
const lowpolyContent = fs.readFileSync(lowpolyPath, 'utf-8');
const hasNoTopLevelLowpolyPreload = !lowpolyContent.includes("useGLTF.preload('/models/karateka_techniques_v4.glb');");

const dojoPath = path.join(CLIENT_DIR, 'src', 'three', 'TraditionalDojo.jsx');
const dojoContent = fs.readFileSync(dojoPath, 'utf-8');
const hasNoTopLevelDojoPreload = !dojoContent.includes("useGLTF.preload('/models/dojo.glb');");

recordCheck(
  'Three.js 3D Preload Optimization',
  hasNoTopLevelLowpolyPreload && hasNoTopLevelDojoPreload,
  `Устранена избыточная синхронная фоновая загрузка 37+ МБ моделей: lowpoly=${hasNoTopLevelLowpolyPreload}, dojo=${hasNoTopLevelDojoPreload}`
);

// 5. Проверка динамического lazy-монтажа студий бункая и мокапа
const bunkaiFormPath = path.join(CLIENT_DIR, 'src', 'pages', 'BunkaiFormPage.jsx');
const bunkaiFormContent = fs.readFileSync(bunkaiFormPath, 'utf-8');
const hasLazyBunkaiPlayer = bunkaiFormContent.includes("lazy(() => import('../three/BunkaiMultiAvatarPlayer'))");

const studioPagePath = path.join(CLIENT_DIR, 'src', 'pages', 'KarateStudioPage.jsx');
const studioPageContent = fs.readFileSync(studioPagePath, 'utf-8');
const hasLazyStudioMixer = studioPageContent.includes("lazy(() => import('../three/ModularMotionMixer'))");

recordCheck(
  'Dynamic Code Splitting for 3D Viewers',
  hasLazyBunkaiPlayer && hasLazyStudioMixer,
  `BunkaiForm lazy: ${hasLazyBunkaiPlayer}, KarateStudio lazy: ${hasLazyStudioMixer}`
);

// 6. Проверка веса фонового постера Сенсея
const heroImgPath = path.join(CLIENT_DIR, 'src', 'assets', 'karate_master_realistic.jpg');
const heroImgSize = fs.statSync(heroImgPath).size;
const isHeroOptimized = heroImgSize < 160 * 1024;
recordCheck(
  'Hero Image Compression (LCP)',
  isHeroOptimized,
  `Размер: ${(heroImgSize / 1024).toFixed(1)} КБ (было 684 КБ, экономия: ${(((684 * 1024 - heroImgSize) / (684 * 1024)) * 100).toFixed(0)}%)`
);

// 7. Проверка index.html (link rel=preload)
const indexPath = path.join(CLIENT_DIR, 'index.html');
const indexContent = fs.readFileSync(indexPath, 'utf-8');
const hasPreload = indexContent.includes('rel="preload" as="image"') && indexContent.includes('fetchpriority="high"');
recordCheck(
  'HTML Preload Resource Hints',
  hasPreload,
  hasPreload ? 'Preload для первого экрана настроен в head' : 'Preload отсутствует'
);

// 8. Проверка Nginx конфигурации и Dockerfile
const nginxConfPath = path.join(NGINX_DIR, 'nginx.conf');
const defaultConfPath = path.join(NGINX_DIR, 'conf.d', 'default.conf');
const nginxDockerfilePath = path.join(NGINX_DIR, 'Dockerfile');

const hasNginxFiles = fs.existsSync(nginxConfPath) && fs.existsSync(defaultConfPath) && fs.existsSync(nginxDockerfilePath);
recordCheck(
  'Nginx Configuration Files',
  hasNginxFiles,
  hasNginxFiles ? 'nginx.conf, conf.d/default.conf и Dockerfile созданы' : 'Файлы отсутствуют'
);

// 9. Проверка синтаксиса Nginx через Docker
let nginxSyntaxOk = false;
try {
  const testOut = execSync(
    `docker run --rm -v "${nginxConfPath.replace(/\\/g, '/')}:/etc/nginx/nginx.conf:ro" -v "${path.join(NGINX_DIR, 'conf.d').replace(/\\/g, '/')}:/etc/nginx/conf.d:ro" nginx:alpine nginx -t 2>&1`,
    { encoding: 'utf-8' }
  );
  nginxSyntaxOk = testOut.includes('syntax is ok') && testOut.includes('test is successful');
  recordCheck('Nginx Syntax Test (nginx -t)', nginxSyntaxOk, 'nginx.conf: syntax is ok, test is successful');
} catch (e) {
  recordCheck('Nginx Syntax Test (nginx -t)', false, e.message);
}

// 10. Проверка docker-compose.yml и run_docker.ps1
const composePath = path.join(ROOT_DIR, 'docker-compose.yml');
const composeContent = fs.readFileSync(composePath, 'utf-8');
const hasNginxService = composeContent.includes('bunkai-explorer-nginx') && composeContent.includes('ports:') && composeContent.includes("'80:80'");

const runDockerPath = path.join(ROOT_DIR, 'run_docker.ps1');
const runDockerContent = fs.readFileSync(runDockerPath, 'utf-8');
const hasRunDockerNginx = runDockerContent.includes('Nginx Proxy') || runDockerContent.includes('Nginx Web Proxy');

recordCheck(
  'Docker Compose & Launcher Integration',
  hasNginxService && hasRunDockerNginx,
  `docker-compose сервис: ${hasNginxService}, run_docker.ps1: ${hasRunDockerNginx}`
);

// 11. Проверка сборки Vite Production Bundle
const distIndexPath = path.join(CLIENT_DIR, 'dist', 'index.html');
const hasDist = fs.existsSync(distIndexPath);
recordCheck(
  'Vite Production Build (dist)',
  hasDist,
  hasDist ? 'Production bundle собран и готов к раздаче Nginx' : 'dist отсутствует'
);

console.log('\n================================================================');
if (auditResults.allPassed) {
  console.log('🎉 ВСЕ ПРОВЕРКИ ОПТИМИЗАЦИИ 1-ГО ЭКРАНА И NGINX УСПЕШНО ПРОЙДЕНЫ!');
} else {
  console.log('⚠️ ОБНАРУЖЕНЫ ЗАМЕЧАНИЯ В ХОДЕ АУДИТА');
}
console.log('================================================================');

fs.writeFileSync(
  path.join(ROOT_DIR, 'scripts', 'optimization_audit_results.json'),
  JSON.stringify(auditResults, null, 2),
  'utf-8'
);

process.exit(auditResults.allPassed ? 0 : 1);
