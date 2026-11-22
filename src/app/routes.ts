// 화면 이름. 주소의 # 뒤에 그대로 붙는다 (예: #items).

export const ROUTES = [
  'home',
  'items',
  'bom',
  'routing',
  'processes',
  'equipment',
  'work-centers',
  'partners',
  'codes',
  'attributes',
  'data',
] as const;

export type RouteName = (typeof ROUTES)[number];

export function isRoute(value: string): value is RouteName {
  return (ROUTES as readonly string[]).includes(value);
}
