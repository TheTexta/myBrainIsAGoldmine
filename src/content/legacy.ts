import { parseFragment, serializeOuter, type DefaultTreeAdapterMap } from 'parse5';
import source from './legacy.html?raw';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];

const keys = [
    'goldmine', 'jeffrey-lewis', 'notes-app', 'reading', 'sixteenth-note',
    'alphabet', 'aftertaste-of-june', 'manic-pixie', 'archives', 'morally-mallory', 'conclusive',
];

function text(node: Node): string {
    return 'value' in node ? node.value : 'childNodes' in node ? node.childNodes.map(text).join('') : '';
}

export interface LegacyEntry {
    id: string;
    key: string;
    title: string;
    group: number;
    position: number;
    html: string;
    body: string;
}

// Trusted, repository-owned HTML only. Editor content never goes through this path.
export const legacyEntries: LegacyEntry[] = [];
const panels = parseFragment(source).childNodes.filter((node): node is Element => 'tagName' in node);
for (const [group, panel] of panels.entries()) {
    let nodes: Node[] = [];
    const flush = () => {
        const heading = nodes.find((node): node is Element => 'tagName' in node && node.tagName === 'h1');
        if (!heading) return;
        const index = legacyEntries.length;
        legacyEntries.push({
            id: `b1710000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
            key: keys[index]!, title: text(heading), group, position: index + 1,
            html: nodes.map((node) => serializeOuter(node)).join(''),
            body: nodes.filter((node) => node !== heading).map((node) => serializeOuter(node)).join(''),
        });
    };
    for (const node of panel.childNodes) {
        if ('tagName' in node && node.tagName === 'h1' && nodes.some((item) => 'tagName' in item && item.tagName === 'h1')) {
            flush();
            nodes = [];
        }
        nodes.push(node);
    }
    flush();
}
