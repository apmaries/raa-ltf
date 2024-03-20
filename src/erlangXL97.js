const MaxAccuracy = 0.00001;

function minMax(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function erlangB(servers, intensity) {
  // The Erlang B formula calculates the percentage likelihood of the call
  // being blocked, that is that all the trunks are in use and the caller
  // will receive a busy signal.
  // servers = Number of telephone lines
  // intensity = Arrival rate of calls / Completion rate of calls
  //   Arrival rate = the number of calls arriving per hour
  //   Completion rate = the number of calls completed per hour
  let val, last, B;

  if (servers < 0 || intensity < 0) {
    return 0;
  }

  let maxIterate = Math.floor(servers);
  val = intensity;
  last = 1; // for server = 0

  for (let count = 1; count <= maxIterate; count++) {
    B = (val * last) / (count + val * last);
    last = B;
  }

  return minMax(B, 0, 1);
}

function erlangC(servers, intensity) {
  // This formula gives the percentage likelihood of the caller being
  // placed in a queue.
  // servers = Number of agents
  // intensity = Arrival rate of calls / Completion rate of calls
  //   Arrival rate = the number of calls arriving per hour
  //   Completion rate = the number of calls completed per hour
  let B, C;

  if (servers < 0 || intensity < 0) {
    return 0;
  }

  B = erlangB(servers, intensity);
  C = B / ((intensity / servers) * B + (1 - intensity / servers));

  return minMax(C, 0, 1);
}

export async function agents(SLA, ServiceTime, CallsPerHour, AHT) {
  // Calculate the number of agents required to service a given number of calls to meet the service level
  // SLA is the % of calls to be answered within the ServiceTime period  e.g. 0.95  (95%)
  // ServiceTime is target answer time in seconds e.g. 15
  // CallsPerHour is the number of calls received in one hour period
  // AHT is the call duration including after call work in seconds  e.g 180
  let BirthRate, DeathRate, TrafficRate, Erlangs, Utilisation, C, SLQueued;
  let NoAgents, MaxIterate, Server;

  if (SLA > 1) SLA = 1;
  BirthRate = CallsPerHour;
  DeathRate = 3600 / AHT;
  // calculate the traffic intensity
  TrafficRate = BirthRate / DeathRate;
  // calculate the number of Erlangs/hours
  Erlangs = Math.round((BirthRate * AHT) / 3600);
  // start at number of agents for 100% utilisation
  NoAgents = Erlangs < 1 ? 1 : Math.floor(Erlangs);
  Utilisation = TrafficRate / NoAgents;
  // now get real and get number below 100%
  while (Utilisation >= 1) {
    NoAgents += 1;
    Utilisation = TrafficRate / NoAgents;
  }
  MaxIterate = NoAgents * 100;
  // try each number of agents until the correct SLA is reached
  for (let Count = 1; Count <= MaxIterate; Count++) {
    Utilisation = TrafficRate / NoAgents;
    if (Utilisation < 1) {
      Server = NoAgents;
      try {
        C = await erlangC(Server, TrafficRate);
        // find the level of SLA with this number of agents
        SLQueued =
          1 - C * Math.exp(((TrafficRate - Server) * ServiceTime) / AHT);
        if (SLQueued < 0) SLQueued = 0;
        if (SLQueued >= SLA || SLQueued > 1 - MaxAccuracy) Count = MaxIterate;
      } catch (error) {
        SLQueued = 0;
      }
    }
    if (Count !== MaxIterate) NoAgents += 1;
  }

  return NoAgents;
}

export async function sla(Agents, ServiceTime, CallsPerHour, AHT) {
  // Calculate the service level achieved for the given number of agents
  // Agents is the number of agents available
  // ServiceTime is target answer time in seconds e.g. 15
  // CallsPerHour is the number of calls received in one hour period
  // AHT (Average handle time) is the call duration including after call work in seconds  e.g 180
  let BirthRate, DeathRate, TrafficRate, Utilisation, C, SLQueued, Server;

  BirthRate = CallsPerHour;
  DeathRate = 3600 / AHT;
  // calculate the traffic intensity
  TrafficRate = BirthRate / DeathRate;
  Utilisation = TrafficRate / Agents;
  if (Utilisation >= 1) Utilisation = 0.99;
  Server = Agents;
  try {
    C = await erlangC(Server, TrafficRate);
    // now calculate SLA % as those not queuing plus those queuing
    // revised formula with thanks to Tim Bolte and Jørn Lodahl for their input
    SLQueued = 1 - C * Math.exp(((TrafficRate - Server) * ServiceTime) / AHT);
  } catch (error) {
    SLQueued = 0;
  }

  return Math.max(Math.min(SLQueued, 1), 0); // equivalent to MinMax in VBA
}
