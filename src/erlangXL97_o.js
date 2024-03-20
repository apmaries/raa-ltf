// Desc: Erlang B and C functions
const MaxAccuracy = 0.00001;
const MaxLoops = 100;

// Basic telephony functions e.g. ErlangB/C start
export async function erlangB(servers, intensity) {
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

  try {
    let maxIterate = Math.floor(servers);
    val = intensity;
    last = 1; // for server = 0
    for (let count = 1; count <= maxIterate; count++) {
      B = (val * last) / (count + val * last);
      last = B;
    }
  } catch (error) {
    B = 0;
  }

  return Math.max(Math.min(B, 1), 0); // equivalent to MinMax in VBA
}

export async function erlangC(servers, intensity) {
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

  try {
    B = erlangB(servers, intensity);
    C = B / ((intensity / servers) * B + (1 - intensity / servers));
  } catch (error) {
    C = 0;
  }

  return Math.max(Math.min(C, 1), 0); // equivalent to MinMax in VBA
}

export async function nbTrunks(Intensity, Blocking) {
  let B, Count, SngCount;
  let MaxIterate = 65535;

  if (Intensity <= 0 || Blocking <= 0) {
    return 0;
  }

  for (Count = Math.ceil(Intensity); Count <= MaxIterate; Count++) {
    SngCount = Count;
    B = erlangB(SngCount, Intensity);
    if (B <= Blocking) break;
  }

  if (Count === MaxIterate) Count = 0;

  return Count;
}

export async function numberTrunks(Servers, Intensity) {
  let B, Server;
  let Count,
    MaxIterate = 65535;

  if (Servers < 0 || Intensity < 0) {
    return 0;
  }

  for (Count = Math.ceil(Servers); Count <= MaxIterate; Count++) {
    Server = Count;
    B = erlangB(Server, Intensity);
    if (B < 0.001) break;
  }

  return Count;
}

export async function servers(Blocking, Intensity) {
  let Val, Last, B;
  let Count = 0;

  if (Blocking < 0 || Intensity < 0) {
    return 0;
  }

  Val = Intensity;
  Last = 1;
  B = 1;

  while (B > Blocking && B > 0.001) {
    Count++;
    B = (Val * Last) / (Count + Val * Last);
    Last = B;
  }

  return Count;
}

export async function traffic(Servers, Blocking) {
  let B, Incr, Trunks;
  let MaxI;

  Trunks = Math.floor(Servers);
  if (Servers < 1 || Blocking < 0) {
    return 0;
  }

  MaxI = Trunks;
  B = erlangB(Servers, MaxI);
  while (B < Blocking) {
    MaxI *= 2;
    B = erlangB(Servers, MaxI);
  }

  Incr = 1;
  while (Incr <= MaxI / 100) {
    Incr *= 10;
  }

  return loopingTraffic(Trunks, Blocking, Incr, MaxI, 0);
}

// Basic telephony functions e.g. ErlangB/C functions end

// Helper export async function start
export async function loopingTraffic(
  trunks,
  blocking,
  increment,
  maxIntensity,
  minIntensity
) {
  let incr, loopNo, B, minI, maxI, intensity;

  minI = minIntensity;
  maxI = maxIntensity;
  B = erlangB(trunks, minI);
  if (B === blocking) {
    return minI;
  }
  incr = increment;
  intensity = minI;
  loopNo = 0;
  while (incr >= MaxAccuracy && loopNo < MaxLoops) {
    B = erlangB(trunks, intensity);
    if (B > blocking) {
      maxI = intensity;
      incr = incr / 10;
      intensity = minI;
    }
    minI = intensity;
    intensity = intensity + incr;
    loopNo++;
  }
  return minI;
}

export async function secs(amount) {
  // Convert a number of hours into seconds
  return Math.floor(amount * 3600 + 0.5);
}

export async function minMax(val, min, max) {
  // Apply minimum and maximum bounds to a value
  return Math.max(Math.min(val, max), min);
}

export async function intCeiling(val) {
  // Ceiling function, rounds to the nearest numerically higher integer
  let S;
  if (val < 0) {
    S = val - 0.9999;
  } else {
    S = val + 0.9999;
  }
  return Math.floor(S);
}
// Helper export async function end

// Contact Centre functions start
export async function abandon(agents, abandonTime, callsPerHour, AHT) {
  let birthRate, deathRate, trafficRate, aband, C, server, utilisation;

  try {
    birthRate = callsPerHour;
    deathRate = 3600 / AHT;
    trafficRate = birthRate / deathRate;
    server = agents;
    utilisation = trafficRate / server;
    if (utilisation >= 1) utilisation = 0.99;
    C = erlangC(server, trafficRate);
    aband = C * Math.exp((trafficRate - server) * (abandonTime / AHT));
  } catch (error) {
    aband = 0;
  }

  return minMax(aband, 0, 1);
}

export async function agents(SLA, serviceTime, callsPerHour, AHT) {
  let birthRate, deathRate, trafficRate, erlangs, utilisation, C, SLQueued;
  let noAgents, maxIterate, count, server;

  try {
    if (SLA > 1) SLA = 1;
    birthRate = callsPerHour;
    deathRate = 3600 / AHT;
    trafficRate = birthRate / deathRate;
    erlangs = Math.floor((birthRate * AHT) / 3600 + 0.5);
    noAgents = erlangs < 1 ? 1 : Math.floor(erlangs);
    utilisation = trafficRate / noAgents;
    while (utilisation >= 1) {
      noAgents++;
      utilisation = trafficRate / noAgents;
    }
    maxIterate = noAgents * 100;
    for (count = 1; count <= maxIterate; count++) {
      utilisation = trafficRate / noAgents;
      if (utilisation < 1) {
        server = noAgents;
        C = erlangC(server, trafficRate);
        SLQueued =
          1 - C * Math.exp(((trafficRate - server) * serviceTime) / AHT);
        if (SLQueued < 0) SLQueued = 0;
        if (SLQueued >= SLA || SLQueued > 1 - MaxAccuracy) {
          break;
        }
      }
      if (count !== maxIterate) noAgents++;
    }
  } catch (error) {
    noAgents = 0;
  }

  return noAgents;
}

export async function agentsAsa(ASA, callsPerHour, AHT) {
  let birthRate, deathRate, trafficRate, erlangs, utilisation, C, answerTime;
  let noAgents, maxIterate, count, server;

  try {
    if (ASA < 0) ASA = 1;
    birthRate = callsPerHour;
    deathRate = 3600 / AHT;
    trafficRate = birthRate / deathRate;
    erlangs = Math.floor((birthRate * AHT) / 3600 + 0.5);
    noAgents = erlangs < 1 ? 1 : Math.floor(erlangs);
    utilisation = trafficRate / noAgents;
    while (utilisation >= 1) {
      noAgents++;
      utilisation = trafficRate / noAgents;
    }
    maxIterate = noAgents * 100;
    for (count = 1; count <= maxIterate; count++) {
      server = noAgents;
      utilisation = trafficRate / noAgents;
      C = erlangC(server, trafficRate);
      answerTime = C / (server * deathRate * (1 - utilisation));
      if (answerTime * 3600 <= ASA) count = maxIterate;
      if (count !== maxIterate) noAgents++;
    }
  } catch (error) {
    noAgents = 0;
  }

  return noAgents;
}

export async function nbAgents(CallsPH, AvgSA, AvgHT) {
  let B, count, SngCount;
  let MaxIterate;

  try {
    MaxIterate = 0;
    if (CallsPH <= 0 || AvgSA <= 0 || AvgHT <= 0) {
      return 0;
    }
    MaxIterate = 65535; // max integer value
    for (count = 1; count <= MaxIterate; count++) {
      SngCount = count;
      B = ASA(SngCount, CallsPH, AvgHT);
      if (B <= AvgSA) break;
    }
    if (count === MaxIterate) count = 0; // did not find the answer so return as error
  } catch (error) {
    count = 0;
  }

  return count;
}

export async function asa(Agents, CallsPerHour, AHT) {
  let BirthRate, DeathRate, TrafficRate;
  let Utilisation, AnswerTime, AveAnswer;
  let C, Server;

  try {
    BirthRate = CallsPerHour;
    DeathRate = 3600 / AHT;
    TrafficRate = BirthRate / DeathRate;
    Server = Agents;
    Utilisation = TrafficRate / Server;
    if (Utilisation >= 1) Utilisation = 0.99;
    C = erlangC(Server, TrafficRate);
    AnswerTime = C / (Server * DeathRate * (1 - Utilisation));
    AveAnswer = Math.round(AnswerTime);
  } catch (error) {
    AveAnswer = 0;
  }

  return AveAnswer;
}

export async function callCapacity(NoAgents, SLA, ServiceTime, AHT) {
  let Calls, xAgent, MaxIterate, xNoAgent;

  try {
    xNoAgent = Math.floor(NoAgents);
    Calls = Math.ceil(3600 / AHT) * xNoAgent;
    xAgent = agents(SLA, ServiceTime, Calls, AHT);
    while (xAgent > xNoAgent && Calls > 0) {
      Calls--;
      xAgent = agents(SLA, ServiceTime, Calls, AHT);
    }
  } catch (error) {
    Calls = 0;
  }

  return Calls;
}

export async function fractionalAgents(SLA, ServiceTime, CallsPerHour, AHT) {
  let BirthRate, DeathRate, TrafficRate;
  let Erlangs, Utilisation, C, SLQueued;
  let LastSLQ, Fract, OneAgent, NoAgentsSng;
  let NoAgents, MaxIterate, Count;
  let Server;

  try {
    if (SLA > 1) SLA = 1;
    BirthRate = CallsPerHour;
    DeathRate = 3600 / AHT;
    TrafficRate = BirthRate / DeathRate;
    Erlangs = Math.floor((BirthRate * AHT) / 3600 + 0.5);
    NoAgents = Erlangs < 1 ? 1 : Math.floor(Erlangs);
    Utilisation = TrafficRate / NoAgents;
    while (Utilisation >= 1) {
      NoAgents++;
      Utilisation = TrafficRate / NoAgents;
    }
    SLQueued = 0;
    MaxIterate = NoAgents * 100;
    for (Count = 1; Count <= MaxIterate; Count++) {
      LastSLQ = SLQueued;
      Utilisation = TrafficRate / NoAgents;
      if (Utilisation < 1) {
        Server = NoAgents;
        C = erlangC(Server, TrafficRate);
        SLQueued =
          1 - C * Math.exp(((TrafficRate - Server) * ServiceTime) / AHT);
        if (SLQueued < 0) SLQueued = 0;
        if (SLQueued > 1) SLQueued = 1;
        if (SLQueued >= SLA || SLQueued > 1 - MaxAccuracy) Count = MaxIterate;
      }
      if (Count !== MaxIterate) NoAgents++;
    }
    NoAgentsSng = NoAgents;
    if (SLQueued > SLA) {
      OneAgent = SLQueued - LastSLQ;
      Fract = SLA - LastSLQ;
      NoAgentsSng = Fract / OneAgent + (NoAgents - 1);
    }
  } catch (error) {
    NoAgentsSng = 0;
  }

  return NoAgentsSng;
}

export async function fractionalCallCapacity(NoAgents, SLA, ServiceTime, AHT) {
  let Calls, xAgent, xNoAgent;

  try {
    xNoAgent = NoAgents;
    Calls = Math.ceil((3600 / AHT) * xNoAgent);
    xAgent = fractionalAgents(SLA, ServiceTime, Calls, AHT);
    while (xAgent > xNoAgent && Calls > 0) {
      Calls--;
      xAgent = fractionalAgents(SLA, ServiceTime, Calls, AHT);
    }
  } catch (error) {
    Calls = 0;
  }

  return Calls;
}

export async function queued(Agents, CallsPerHour, AHT) {
  let BirthRate, DeathRate, TrafficRate;
  let Q, Server;

  try {
    BirthRate = CallsPerHour;
    DeathRate = 3600 / AHT;
    TrafficRate = BirthRate / DeathRate;
    Server = Agents;
    Q = erlangC(Server, TrafficRate);
  } catch (error) {
    Q = 0;
  }

  return Math.min(Math.max(Q, 0), 1);
}

export async function queueSize(Agents, CallsPerHour, AHT) {
  let BirthRate, DeathRate, TrafficRate;
  let C, Server, QSize, Utilisation;

  try {
    BirthRate = CallsPerHour;
    DeathRate = 3600 / AHT;
    TrafficRate = BirthRate / DeathRate;
    Server = Agents;
    Utilisation = TrafficRate / Server;
    if (Utilisation >= 1) {
      QSize = CallsPerHour;
    } else {
      C = erlangC(Server, TrafficRate);
      QSize = (Utilisation * C) / (1 - Utilisation);
    }
  } catch (error) {
    QSize = 0;
  }

  return Math.round(QSize);
}

export async function fractionalQueueSize(Agents, CallsPerHour, AHT) {
  let BirthRate, DeathRate, TrafficRate;
  let C, Server, QSize, Utilisation;

  try {
    BirthRate = CallsPerHour;
    DeathRate = 3600 / AHT;
    TrafficRate = BirthRate / DeathRate;
    Server = Agents;
    Utilisation = TrafficRate / Server;
    if (Utilisation >= 1) {
      QSize = CallsPerHour;
    } else {
      C = erlangC(Server, TrafficRate);
      QSize = (Utilisation * C) / (1 - Utilisation);
    }
  } catch (error) {
    QSize = 0;
  }

  return Math.round(QSize * 10) / 10; // round to 1 decimal place
}

export async function queueTime(Agents, CallsPerHour, AHT) {
  let BirthRate, DeathRate, TrafficRate;
  let C, Server, QTime, Utilisation;

  try {
    BirthRate = CallsPerHour;
    DeathRate = 3600 / AHT;
    TrafficRate = BirthRate / DeathRate;
    Server = Agents;
    Utilisation = TrafficRate / Server;
    if (Utilisation >= 1) Utilisation = 0.99;
    QTime = 1 / (Server * DeathRate * (1 - Utilisation));
  } catch (error) {
    QTime = 0;
  }

  return QTime;
}

export async function serviceTime(Agents, SLA, CallsPerHour, AHT) {
  let BirthRate, DeathRate, TrafficRate, Utilisation;
  let C, Server, STime, QTime, Adjust;

  try {
    Adjust = 0;
    BirthRate = CallsPerHour;
    DeathRate = 3600 / AHT;
    TrafficRate = BirthRate / DeathRate;
    C = erlangC(Agents, TrafficRate);
    if (C < 1 - SLA) throw new Error("None will be queued so return 0 seconds");
    Server = Agents;
    Utilisation = TrafficRate / Server;
    if (Utilisation >= 1) Utilisation = 0.99;
    QTime = (1 / (Server * DeathRate * (1 - Utilisation))) * 3600;
    STime = QTime * (1 - (1 - SLA) / C);
    let Ag = agents(SLA, Math.floor(STime), CallsPerHour, AHT);
    if (Ag !== Agents) Adjust = 1;
  } catch (error) {
    STime = 0;
    Adjust = 0;
  }

  return Math.floor(STime + Adjust);
}

export async function sla(Agents, ServiceTime, CallsPerHour, AHT) {
  let BirthRate, DeathRate, TrafficRate;
  let Utilisation, C, SLQueued;
  let Server;

  try {
    BirthRate = CallsPerHour;
    DeathRate = 3600 / AHT;
    TrafficRate = BirthRate / DeathRate;
    Utilisation = TrafficRate / Agents;
    if (Utilisation >= 1) Utilisation = 0.99;
    Server = Agents;
    C = erlangC(Server, TrafficRate);
    SLQueued = 1 - C * Math.exp(((TrafficRate - Server) * ServiceTime) / AHT);
  } catch (error) {
    SLQueued = 0;
  }

  return Math.min(Math.max(SLQueued, 0), 1);
}

export async function trunks(Agents, CallsPerHour, AHT) {
  let BirthRate, DeathRate, TrafficRate;
  let Utilisation, C, AnswerTime;
  let NoTrunks;
  let Server, R;

  try {
    BirthRate = CallsPerHour;
    DeathRate = 3600 / AHT;
    TrafficRate = BirthRate / DeathRate;
    Server = Agents;
    Utilisation = TrafficRate / Server;
    if (Utilisation >= 1) Utilisation = 0.99;
    C = erlangC(Server, TrafficRate);
    AnswerTime = C / (Server * DeathRate * (1 - Utilisation));
    R = BirthRate / (3600 / (AHT + AnswerTime));
    NoTrunks = numberTrunks(Server, R);
    if (NoTrunks < 1 && TrafficRate > 0) NoTrunks = 1;
  } catch (error) {
    NoTrunks = 0;
  }

  return NoTrunks;
}

export async function utilisation(Agents, CallsPerHour, AHT) {
  let BirthRate, DeathRate, TrafficRate;
  let Util;

  try {
    BirthRate = CallsPerHour;
    DeathRate = 3600 / AHT;
    TrafficRate = BirthRate / DeathRate;
    Util = TrafficRate / Agents;
  } catch (error) {
    Util = 0;
  }

  return Math.min(Math.max(Util, 0), 1);
}

// Contact Centre functions end
