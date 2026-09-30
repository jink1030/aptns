'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchNotes } from '@/lib/db';
import type { Note, NoteCategory } from '@/types';

const CATEGORY_COLORS: Record<NoteCategory, string> = {
  idea: '#f59e0b',
  work: '#3b82f6',
  research: '#6366f1',
  personal: '#ec4899',
};

const CATEGORY_LABELS: Record<NoteCategory, string> = {
  idea: '아이디어',
  work: '업무',
  research: '리서치',
  personal: '개인',
};

interface SimNode {
  id: string;
  label: string;
  category: NoteCategory;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tags: string[];
}

interface SimLink {
  source: string;
  target: string;
}

export default function GraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const dragRef = useRef<{ node: SimNode | null; offsetX: number; offsetY: number }>({
    node: null, offsetX: 0, offsetY: 0,
  });
  const animRef = useRef<number>(0);

  useEffect(() => {
    fetchNotes().then((allNotes) => {
    setNotes(allNotes);

    const nodes: SimNode[] = allNotes.map((n, i) => ({
      id: n.id,
      label: n.title,
      category: n.category,
      x: 400 + Math.cos((i / allNotes.length) * Math.PI * 2) * 200 + Math.random() * 40,
      y: 300 + Math.sin((i / allNotes.length) * Math.PI * 2) * 200 + Math.random() * 40,
      vx: 0,
      vy: 0,
      tags: n.tags,
    }));

    const links: SimLink[] = [];
    allNotes.forEach((note) => {
      note.linkedNoteIds.forEach((targetId) => {
        if (allNotes.some((n) => n.id === targetId)) {
          if (!links.some((l) => (l.source === note.id && l.target === targetId) || (l.source === targetId && l.target === note.id))) {
            links.push({ source: note.id, target: targetId });
          }
        }
      });
    });

    // Also link notes sharing tags
    for (let i = 0; i < allNotes.length; i++) {
      for (let j = i + 1; j < allNotes.length; j++) {
        const shared = allNotes[i].tags.filter((t) => allNotes[j].tags.includes(t));
        if (shared.length > 0 && !links.some((l) =>
          (l.source === allNotes[i].id && l.target === allNotes[j].id) ||
          (l.source === allNotes[j].id && l.target === allNotes[i].id)
        )) {
          links.push({ source: allNotes[i].id, target: allNotes[j].id });
        }
      }
    }

    nodesRef.current = nodes;
    linksRef.current = links;
    });

    return () => cancelAnimationFrame(animRef.current);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function resize() {
      const rect = canvas!.parentElement!.getBoundingClientRect();
      canvas!.width = rect.width;
      canvas!.height = rect.height;
    }
    resize();
    window.addEventListener('resize', resize);

    function simulate() {
      const nodes = nodesRef.current;
      const links = linksRef.current;
      const w = canvas!.width;
      const h = canvas!.height;
      const cx = w / 2;
      const cy = h / 2;

      // Force simulation
      for (const node of nodes) {
        // Center gravity
        node.vx += (cx - node.x) * 0.001;
        node.vy += (cy - node.y) * 0.001;

        // Repulsion
        for (const other of nodes) {
          if (other.id === node.id) continue;
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 200) {
            const force = 300 / (dist * dist);
            node.vx += (dx / dist) * force;
            node.vy += (dy / dist) * force;
          }
        }
      }

      // Attraction along links
      for (const link of links) {
        const src = nodes.find((n) => n.id === link.source);
        const tgt = nodes.find((n) => n.id === link.target);
        if (!src || !tgt) continue;
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 120) * 0.003;
        src.vx += (dx / dist) * force;
        src.vy += (dy / dist) * force;
        tgt.vx -= (dx / dist) * force;
        tgt.vy -= (dy / dist) * force;
      }

      // Apply velocity
      for (const node of nodes) {
        if (dragRef.current.node?.id === node.id) continue;
        node.vx *= 0.9;
        node.vy *= 0.9;
        node.x += node.vx;
        node.y += node.vy;
        node.x = Math.max(30, Math.min(w - 30, node.x));
        node.y = Math.max(30, Math.min(h - 30, node.y));
      }

      // Draw
      ctx!.clearRect(0, 0, w, h);

      // Links
      for (const link of links) {
        const src = nodes.find((n) => n.id === link.source);
        const tgt = nodes.find((n) => n.id === link.target);
        if (!src || !tgt) continue;
        ctx!.beginPath();
        ctx!.moveTo(src.x, src.y);
        ctx!.lineTo(tgt.x, tgt.y);
        ctx!.strokeStyle = '#e2e8f0';
        ctx!.lineWidth = 1.5;
        ctx!.stroke();
      }

      // Nodes
      for (const node of nodes) {
        const color = CATEGORY_COLORS[node.category];
        const r = hoveredNode?.id === node.id ? 22 : 16;

        ctx!.beginPath();
        ctx!.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx!.fillStyle = color;
        ctx!.fill();

        if (hoveredNode?.id === node.id) {
          ctx!.strokeStyle = color;
          ctx!.lineWidth = 3;
          ctx!.stroke();
        }

        ctx!.fillStyle = '#1e293b';
        ctx!.font = '11px -apple-system, sans-serif';
        ctx!.textAlign = 'center';
        ctx!.fillText(node.label.slice(0, 12), node.x, node.y + r + 14);
      }

      animRef.current = requestAnimationFrame(simulate);
    }

    simulate();

    function getNodeAt(x: number, y: number): SimNode | null {
      for (const node of nodesRef.current) {
        const dx = x - node.x;
        const dy = y - node.y;
        if (dx * dx + dy * dy < 20 * 20) return node;
      }
      return null;
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (dragRef.current.node) {
        dragRef.current.node.x = x;
        dragRef.current.node.y = y;
        return;
      }

      const node = getNodeAt(x, y);
      setHoveredNode(node);
      canvas!.style.cursor = node ? 'grab' : 'default';
    }

    function onMouseDown(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (node) {
        dragRef.current = { node, offsetX: 0, offsetY: 0 };
        canvas!.style.cursor = 'grabbing';
      }
    }

    function onMouseUp() {
      dragRef.current = { node: null, offsetX: 0, offsetY: 0 };
    }

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseUp);
    };
  }, [notes, hoveredNode]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">지식 그래프</h1>
          <p className="text-sm text-[var(--muted)]">
            노트 간 연결과 태그 기반 관계를 시각화합니다. 노드를 드래그할 수 있습니다.
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 flex-wrap">
        {Object.entries(CATEGORY_COLORS).map(([key, color]) => (
          <div key={key} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ background: color }} />
            {CATEGORY_LABELS[key as NoteCategory]}
          </div>
        ))}
        <div className="text-xs text-[var(--muted)] ml-auto">
          노트 {notes.length}개 · 연결 {linksRef.current.length}개
        </div>
      </div>

      <div className="graph-container" style={{ height: 560 }}>
        {notes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">
            노트를 추가하면 그래프가 나타납니다. 노트에 태그를 달거나 다른 노트를 연결해보세요!
          </div>
        ) : (
          <canvas ref={canvasRef} />
        )}
      </div>

      {/* Hovered Info */}
      {hoveredNode && (
        <div className="card mt-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full" style={{ background: CATEGORY_COLORS[hoveredNode.category] }} />
            <span className="font-semibold text-sm">{hoveredNode.label}</span>
            <span className={`badge badge-${hoveredNode.category}`}>
              {CATEGORY_LABELS[hoveredNode.category]}
            </span>
          </div>
          {hoveredNode.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {hoveredNode.tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 rounded">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
