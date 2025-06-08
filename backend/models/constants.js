export const ROLES = {
    CIVILIAN: { name: 'Civilian', team: 'town', description: 'Survive and find the mafia' },
    MAFIA: { name: 'Mafia', team: 'mafia', description: 'Eliminate the town' },
    DOCTOR: { name: 'Doctor', team: 'town', description: 'Save one person each night' },
    SHERIFF: { name: 'Sheriff', team: 'town', description: 'Investigate one person each night' }
  };
  
  export const PHASES = {
    LOBBY: 'lobby',
    NIGHT: 'night',
    DAY: 'day',
    VOTING: 'voting',
    RESULTS: 'results',
    ENDED: 'ended'
  };
  
  export function getPhaseDuration(phase) {
    switch (phase) {
      case PHASES.NIGHT:
        return 30; 
      case PHASES.DAY:
        return 120; 
      case PHASES.VOTING:
        return 30; 
      case PHASES.RESULTS:
        return 10; 
      default:
        return 0;
    }
  }