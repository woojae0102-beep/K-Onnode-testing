// @ts-nocheck
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReportCard from '../components/report/ReportCard';
import ReportDetailView from './ReportDetailView';
import {
  fetchMockReports,
  formatReportDateLabel,
  groupReportsByDate,
} from '../mocks/reportMocks';

const PAGE_SIZE = 10;

export default function ReportListView({ onSwitchSubTab }) {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [openReport, setOpenReport] = useState(null);

  const FILTERS = [
    { id: 'all', label: t('report.filterAll') },
    { id: 'dance', label: t('report.trackDance') },
    { id: 'vocal', label: t('report.trackVocal') },
    { id: 'korean', label: t('report.trackKorean') },
  ];

  const data = useMemo(() => fetchMockReports({ track: filter, limit: page * PAGE_SIZE }), [filter, page]);
  const groups = useMemo(() => groupReportsByDate(data.items), [data.items]);
  const hasMore = data.items.length < data.total;

  const handleFilterChange = (id) => {
    setFilter(id);
    setPage(1);
  };

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        background: '#F5F5F7',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          overflowY: 'auto',
          paddingBottom: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            padding: '12px 16px',
            background: '#F5F5F7',
            position: 'sticky',
            top: 0,
            zIndex: 1,
          }}
        >
          {FILTERS.map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleFilterChange(item.id)}
                style={{
                  flexShrink: 0,
                  padding: '6px 14px',
                  borderRadius: 16,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  background: active ? '#FF1F8E' : '#F5F5F5',
                  color: active ? '#FFFFFF' : '#888888',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {groups.length === 0 ? (
          <EmptyState onStart={() => onSwitchSubTab?.('chat')} />
        ) : (
          <>
            {groups.map((group) => (
              <section key={group.date}>
                <p
                  style={{
                    margin: 0,
                    padding: '12px 16px 6px',
                    fontSize: 11,
                    color: '#AAAAAA',
                    fontWeight: 500,
                  }}
                >
                  {formatReportDateLabel(group.date, i18n.language)}
                </p>
                {group.items.map((report) => (
                  <ReportCard
                    key={report.id}
                    report={report}
                    onOpen={(r) => setOpenReport(r)}
                  />
                ))}
              </section>
            ))}
            {hasMore ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 16px 16px' }}>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  style={{
                    background: 'transparent',
                    border: '0.5px solid #E5E5E5',
                    color: '#888888',
                    borderRadius: 8,
                    padding: '8px 18px',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {t('report.loadMore')}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#F5F5F7',
          transform: openReport ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s ease',
          willChange: 'transform',
          pointerEvents: openReport ? 'auto' : 'none',
        }}
      >
        {openReport ? (
          <ReportDetailView
            report={openReport}
            onBack={() => setOpenReport(null)}
            onSwitchSubTab={onSwitchSubTab}
          />
        ) : null}
      </div>
    </div>
  );
}

function EmptyState({ onStart }) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        padding: '60px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: '#FFF0F7',
          display: 'grid',
          placeItems: 'center',
          fontSize: 28,
        }}
      >
        📋
      </div>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#111111' }}>{t('report.emptyTitle')}</p>
      <button
        type="button"
        onClick={onStart}
        style={{
          marginTop: 4,
          background: '#FF1F8E',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 8,
          padding: '10px 18px',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        {t('report.emptyCta')}
      </button>
    </div>
  );
}
