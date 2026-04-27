import { Team, GuildConfig } from '../models/index.js';
import { collections } from '../config/database.js';

export const Rank = {
  NONE: 0,
  PLAYER: 1,
  ASSISTANT_COACH: 2,
  HEAD_COACH: 3,
  GENERAL_MANAGER: 4,
  FRANCHISE_OWNER: 5,
  ADMIN: 99,
};

export const RANK_DISPLAY = {
  [Rank.NONE]: 'Unaffiliated',
  [Rank.PLAYER]: 'Player',
  [Rank.ASSISTANT_COACH]: 'Assistant Coach',
  [Rank.HEAD_COACH]: 'Head Coach',
  [Rank.GENERAL_MANAGER]: 'General Manager',
  [Rank.FRANCHISE_OWNER]: 'Franchise Owner',
  [Rank.ADMIN]: 'Administrator',
};

export const COACH_KEY_TO_RANK = {
  franchise_owner: Rank.FRANCHISE_OWNER,
  general_manager: Rank.GENERAL_MANAGER,
  head_coach: Rank.HEAD_COACH,
  assistant_coach: Rank.ASSISTANT_COACH,
};

export async function getMemberRank(guildId, userId, guildMember = null) {
  const config = await GuildConfig.findOne(guildId);
  const franchiseRoles = config?.franchise_roles || {};

  const roleToCoachKey = {
    [franchiseRoles.franchise_owner || '']: 'franchise_owner',
    [franchiseRoles.general_manager || '']: 'general_manager',
    [franchiseRoles.head_coach || '']: 'head_coach',
    [franchiseRoles.assistant_coach || '']: 'assistant_coach',
  };

  const userRoleIds = guildMember ? guildMember.roles.cache.map(r => r.id.toString()) : [];

  let matchedCoachKey = null;
  let matchedRank = null;

  for (const [roleId, coachKey] of Object.entries(roleToCoachKey)) {
    if (roleId && userRoleIds.includes(roleId)) {
      matchedCoachKey = coachKey;
      matchedRank = COACH_KEY_TO_RANK[coachKey];
      break;
    }
  }

  if (matchedCoachKey) {
    const team = await Team.findOne(guildId, { [`coaches.${matchedCoachKey}`]: userId });
    if (team) return { rank: matchedRank, team };
    const teams = await Team.find(guildId);
    for (const t of teams) {
      if (userRoleIds.includes(t.roleId)) {
        await Team.updateOne(t._id.toString(), { $set: { [`coaches.${matchedCoachKey}`]: userId } });
        return { rank: matchedRank, team: t };
      }
    }
  }

  if (guildMember && guildMember.permissions.has('Administrator')) {
    const teams = await Team.find(guildId);
    for (const team of teams) {
      if (userRoleIds.includes(team.roleId)) {
        const roster = team.roster || [];
        if (!roster.includes(userId)) {
          await Team.updateOne(team._id.toString(), { $addToSet: { roster: userId } });
        }
        return { rank: Rank.PLAYER, team };
      }
    }
    return { rank: Rank.ADMIN, team: null };
  }

  const teams = await Team.find(guildId);
  for (const team of teams) {
    if (userRoleIds.includes(team.roleId)) {
      const roster = team.roster || [];
      if (!roster.includes(userId)) {
        await Team.updateOne(team._id.toString(), { $addToSet: { roster: userId } });
      }
      return { rank: Rank.PLAYER, team };
    }
  }

  const playerTeam = await Team.findOne(guildId, { roster: userId });
  if (playerTeam) return { rank: Rank.PLAYER, team: playerTeam };

  return { rank: Rank.NONE, team: null };
}

export async function getTeamForUser(guildId, userId) {
  return collections.teams().findOne({
    guildId,
    $or: [
      { 'coaches.franchise_owner': userId },
      { 'coaches.general_manager': userId },
      { 'coaches.head_coach': userId },
      { 'coaches.assistant_coach': userId },
      { roster: userId },
    ],
  });
}

export async function canManageTeam(guildId, userId, guildMember = null) {
  const result = await getMemberRank(guildId, userId, guildMember);
  const rank = result.rank;
  const team = result.team;
  if (rank === Rank.ADMIN) return { allowed: true, team };
  if (rank >= Rank.GENERAL_MANAGER) return { allowed: true, team };
  return { allowed: false, team: null };
}

export async function canPromoteDemote(guildId, userId, guildMember = null) {
  return canManageTeam(guildId, userId, guildMember);
}

export async function canActOnMember(guildId, actorId, targetId, actorMember = null) {
  const actorResult = await getMemberRank(guildId, actorId, actorMember);
  const targetResult = await getMemberRank(guildId, targetId, null);

  const actorRank = actorResult.rank;
  const targetRank = targetResult.rank;

  if (actorRank === Rank.ADMIN) return { ok: true, reason: '' };
  if (actorRank === Rank.NONE) return { ok: false, reason: 'You do not have a team role.' };

  if (targetRank >= actorRank) {
    return {
      ok: false,
      reason: `You cannot perform this action on a **${RANK_DISPLAY[targetRank] || 'Unknown'}** while you are a **${RANK_DISPLAY[actorRank] || 'Unknown'}**. You must outrank your target.`,
    };
  }

  return { ok: true, reason: '' };
}

export function getTeamThumbnail(teamEmoji) {
  if (!teamEmoji) return null;
  const match = teamEmoji.match(/<:(.+):(\d+)>/);
  if (match) return `https://cdn.discordapp.com/emojis/${match[2]}.png`;
  return null;
}

export function setGuildHeader(embed, guild) {
  embed.setAuthor({
    name: `${guild.name} Transactions`,
    iconURL: guild.iconURL(),
  });
  return embed;
}