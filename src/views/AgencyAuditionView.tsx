// @ts-nocheck
import React, { useMemo, useState } from 'react';
import { AGENCY_AUDITIONS, getAgencyById } from '../data/agencyAuditions';
import AgencySelector from '../components/audition/AgencySelector';
import AgencyLobby from '../components/audition/AgencyLobby';
import JudgePanel from '../components/audition/JudgePanel';
import AuditionStage from '../components/audition/AuditionStage';
import AgencyResult from '../components/audition/AgencyResult';
import HybeAuditionResult from '../components/audition/HybeAuditionResult';
import SmAuditionResult from '../components/audition/SmAuditionResult';
import JypAuditionResult from '../components/audition/JypAuditionResult';
import YgAuditionResult from '../components/audition/YgAuditionResult';
import StarshipAuditionResult from '../components/audition/StarshipAuditionResult';

const STAGES = ['select', 'lobby', 'judges', 'stage', 'result'];

function generateTicketNumber() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export default function AgencyAuditionView() {
  const [stage, setStage] = useState('select');
  const [agencyId, setAgencyId] = useState(null);
  const [ticketNumber, setTicketNumber] = useState(generateTicketNumber());
  const [rounds, setRounds] = useState({});

  const agency = useMemo(() => getAgencyById(agencyId), [agencyId]);

  const handleSelectAgency = (id) => {
    setAgencyId(id);
    setTicketNumber(generateTicketNumber());
    setRounds({});
    setStage('lobby');
  };

  const handleStartAudition = () => setStage('judges');
  const handleEnterStage = () => setStage('stage');
  const handleStageComplete = ({ rounds: r }) => {
    setRounds(r || {});
    setStage('result');
  };
  const handleRetry = () => {
    setRounds({});
    setTicketNumber(generateTicketNumber());
    setStage('lobby');
  };
  const handleSelectAnotherAgency = () => {
    setAgencyId(null);
    setRounds({});
    setStage('select');
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#0A0A0A' }}>
      {stage === 'select' && <AgencySelector onSelect={handleSelectAgency} />}
      {stage === 'lobby' && (
        <AgencyLobby
          agency={agency}
          ticketNumber={ticketNumber}
          onStart={handleStartAudition}
          onBack={handleSelectAnotherAgency}
        />
      )}
      {stage === 'judges' && (
        <JudgePanel
          agency={agency}
          onContinue={handleEnterStage}
          onBack={() => setStage('lobby')}
        />
      )}
      {stage === 'stage' && (
        <AuditionStage
          agency={agency}
          onComplete={handleStageComplete}
          onBack={() => setStage('judges')}
        />
      )}
      {stage === 'result' && (
        agency?.id === 'hybe' ? (
          <HybeAuditionResult
            rounds={rounds}
            ticketNumber={ticketNumber}
            onRetry={handleRetry}
            onSelectAgency={handleSelectAnotherAgency}
          />
        ) : agency?.id === 'sm' ? (
          <SmAuditionResult
            rounds={rounds}
            ticketNumber={ticketNumber}
            onRetry={handleRetry}
            onSelectAgency={handleSelectAnotherAgency}
          />
        ) : agency?.id === 'jyp' ? (
          <JypAuditionResult
            rounds={rounds}
            ticketNumber={ticketNumber}
            onRetry={handleRetry}
            onSelectAgency={handleSelectAnotherAgency}
          />
        ) : agency?.id === 'yg' ? (
          <YgAuditionResult
            rounds={rounds}
            ticketNumber={ticketNumber}
            onRetry={handleRetry}
            onSelectAgency={handleSelectAnotherAgency}
          />
        ) : agency?.id === 'starship' ? (
          <StarshipAuditionResult
            rounds={rounds}
            ticketNumber={ticketNumber}
            onRetry={handleRetry}
            onSelectAgency={handleSelectAnotherAgency}
          />
        ) : (
          <AgencyResult
            agency={agency}
            rounds={rounds}
            ticketNumber={ticketNumber}
            onRetry={handleRetry}
            onSelectAgency={handleSelectAnotherAgency}
          />
        )
      )}
    </div>
  );
}

export { AGENCY_AUDITIONS };
