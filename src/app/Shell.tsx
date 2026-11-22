import { Boxes, Building2, Cog, Database, LayoutDashboard, ListTree, Menu, Package, Route, SlidersHorizontal, Tags, Warehouse, Workflow, X } from 'lucide-react';
import { useEffect, useState, type ComponentType } from 'react';
import { useAppState } from '../core/store';
import { findTemplate } from '../core/templates';
import { BomPage } from '../pages/BomPage';
import { equipmentConfig, itemsConfig, partnersConfig, processesConfig, workCentersConfig } from '../pages/configs';
import { HomePage } from '../pages/HomePage';
import { RoutingPage } from '../pages/RoutingPage';
import { AttributesPage, CodesPage, DataPage } from '../pages/SettingsPages';
import { IconButton } from '../ui/Button';
import { EntityPage } from '../ui/EntityPage';
import { navigate, useRoute } from './router';
import type { RouteName } from './routes';

interface NavItem {
  route: RouteName;
  label: string;
  icon: ComponentType<{ size?: number }>;
}

const NAV: { section: string | null; items: NavItem[] }[] = [
  { section: null, items: [{ route: 'home', label: '현황', icon: LayoutDashboard }] },
  {
    section: '기준정보',
    items: [
      { route: 'items', label: '품목', icon: Package },
      { route: 'bom', label: 'BOM', icon: ListTree },
      { route: 'processes', label: '공정', icon: Workflow },
      { route: 'routing', label: '라우팅', icon: Route },
      { route: 'equipment', label: '설비', icon: Cog },
      { route: 'work-centers', label: '작업장', icon: Warehouse },
      { route: 'partners', label: '거래처', icon: Building2 },
    ],
  },
  {
    section: '설정',
    items: [
      { route: 'codes', label: '공통코드', icon: Tags },
      { route: 'attributes', label: '사용자 정의 속성', icon: SlidersHorizontal },
      { route: 'data', label: '데이터 관리', icon: Database },
    ],
  },
];

const UPCOMING = ['생산 실행', '품질 관리', '공정 관리', '설계 변경'];

function Page({ route }: { route: RouteName }) {
  switch (route) {
    case 'items':
      return <EntityPage config={itemsConfig} />;
    case 'bom':
      return <BomPage />;
    case 'routing':
      return <RoutingPage />;
    case 'processes':
      return <EntityPage config={processesConfig} />;
    case 'equipment':
      return <EntityPage config={equipmentConfig} />;
    case 'work-centers':
      return <EntityPage config={workCentersConfig} />;
    case 'partners':
      return <EntityPage config={partnersConfig} />;
    case 'codes':
      return <CodesPage />;
    case 'attributes':
      return <AttributesPage />;
    case 'data':
      return <DataPage />;
    default:
      return <HomePage />;
  }
}

export function Shell() {
  const route = useRoute();
  const state = useAppState();
  const [open, setOpen] = useState(false);
  const template = findTemplate(state.meta.templateKey);
  const current = NAV.flatMap((g) => g.items.map((i) => ({ ...i, section: g.section }))).find((i) => i.route === route.name);

  useEffect(() => setOpen(false), [route.nonce]);

  return (
    <div className="shell">
      <nav id="app-nav" className="nav" data-open={open} aria-label="주 메뉴">
        <div className="nav__brand">
          <span className="nav__mark" aria-hidden="true">
            <Boxes size={18} />
          </span>
          <span className="nav__name">
            제조 통합 플랫폼
            <small>기준정보</small>
          </span>
          <IconButton label="메뉴 닫기" className="nav__close" onClick={() => setOpen(false)}>
            <X size={18} />
          </IconButton>
        </div>
        {NAV.map((group) => (
          <div className="nav__group" key={group.section ?? 'top'}>
            {group.section && <p className="nav__section">{group.section}</p>}
            <ul>
              {group.items.map(({ route: r, label, icon: Icon }) => (
                <li key={r}>
                  <a
                    href={`#${r}`}
                    className="nav__link"
                    aria-current={route.name === r ? 'page' : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(r);
                    }}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="nav__group nav__group--upcoming">
          <p className="nav__section">다음 모듈</p>
          <ul>
            {UPCOMING.map((label) => (
              <li key={label} className="nav__soon">
                <span>{label}</span>
                <span className="nav__tag">예정</span>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      {open && <button type="button" className="nav-scrim" aria-label="메뉴 닫기" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <IconButton label="메뉴 열기" className="topbar__menu" aria-controls="app-nav" aria-expanded={open} onClick={() => setOpen(true)}>
            <Menu size={20} />
          </IconButton>
          <p className="topbar__crumb">
            {current?.section && <span className="topbar__section">{current.section}</span>}
            <strong>{current?.label ?? '현황'}</strong>
          </p>
          <button type="button" className="topbar__data" onClick={() => navigate('data')}>
            <Database size={14} />
            <span>{template ? `예시 · ${template.name}` : '내 데이터'}</span>
          </button>
        </header>
        <main className="page" key={route.name}>
          <Page route={route.name} />
        </main>
      </div>
    </div>
  );
}
