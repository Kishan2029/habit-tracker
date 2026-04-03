export const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

export const wrapEmailContent = (content) => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #ffffff;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h2 style="color: #6366f1; margin: 0;">Habit Tracker</h2>
    </div>
    ${content}
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
      You received this email because you have an account on Habit Tracker.<br/>
      If you didn't perform this action, please secure your account immediately.
    </p>
  </div>
`;

export const htmlToText = (html) => String(html)
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n\n')
  .replace(/<li>/gi, '- ')
  .replace(/<\/li>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#039;/g, '\'')
  .replace(/\s+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .replace(/[ \t]{2,}/g, ' ')
  .trim();

export const buildWelcomeEmail = ({ name, clientUrl }) => {
  const html = `
    <h3 style="color: #111827; margin-top: 0;">Welcome, ${escapeHtml(name)}!</h3>
    <p style="color: #374151; line-height: 1.6;">
      Your Habit Tracker account has been created successfully. Start building
      positive habits and track your daily progress.
    </p>
    <p style="color: #374151; line-height: 1.6;">Here are some tips to get started:</p>
    <ul style="color: #374151; line-height: 1.8; padding-left: 20px;">
      <li>Create your first habit from the Habits page</li>
      <li>Log your progress daily from the Today view</li>
      <li>Check your streaks and analytics to stay motivated</li>
    </ul>
    <a href="${clientUrl}/login" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
      Get Started
    </a>
  `;

  return {
    subject: 'Welcome to Habit Tracker!',
    html,
    label: 'Welcome email',
  };
};

export const buildPasswordResetEmail = ({ resetToken, clientUrl }) => {
  const html = `
    <h3 style="color: #111827; margin-top: 0;">Password Reset Request</h3>
    <p style="color: #374151; line-height: 1.6;">
      We received a request to reset your password. Click the button below to set a new password:
    </p>
    <a href="${clientUrl}/reset-password?token=${resetToken}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
      Reset Password
    </a>
    <p style="color: #6b7280; font-size: 14px;">
      This link expires in <strong>30 minutes</strong>. If you didn't request this, you can safely ignore this email.
    </p>
  `;

  return {
    subject: 'Reset your Habit Tracker password',
    html,
    label: 'Password reset email',
  };
};

export const buildPasswordResetConfirmationEmail = ({ name, clientUrl }) => {
  const html = `
    <h3 style="color: #111827; margin-top: 0;">Password Reset Successful</h3>
    <p style="color: #374151; line-height: 1.6;">
      Hi ${escapeHtml(name)}, your password has been successfully reset. You can now log in with your new password.
    </p>
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
      <p style="color: #92400e; font-size: 14px; margin: 0;">
        <strong>Didn't reset your password?</strong> If you didn't make this change, your account may be compromised. Please reset your password immediately or contact support.
      </p>
    </div>
    <a href="${clientUrl}/login" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
      Log In
    </a>
  `;

  return {
    subject: 'Your password has been reset',
    html,
    label: 'Password reset confirmation',
  };
};

export const buildHabitInviteEmail = ({
  inviteeName,
  inviterName,
  habitName,
  inviteCode,
  clientUrl,
}) => {
  const safeInviterName = escapeHtml(inviterName);
  const safeHabitName = escapeHtml(habitName);

  const html = `
    <h3 style="color: #111827; margin-top: 0;">You're Invited!</h3>
    <p style="color: #374151; line-height: 1.6;">
      Hi ${escapeHtml(inviteeName)}, <strong>${safeInviterName}</strong> has invited you to join the shared habit
      <strong>"${safeHabitName}"</strong> on Habit Tracker.
    </p>
    <p style="color: #374151; line-height: 1.6;">
      Track this habit together, stay accountable, and see each other's progress!
    </p>
    <a href="${clientUrl}/join/${inviteCode}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
      Accept Invite
    </a>
    <p style="color: #6b7280; font-size: 14px;">
      Or log into your account and check the Shared Habits page to accept the invite.
    </p>
  `;

  return {
    subject: `${safeInviterName} invited you to "${safeHabitName}" on Habit Tracker`,
    html,
    label: 'Habit invite',
  };
};

export const buildFeedbackNotificationEmail = ({
  userName,
  userEmail,
  mood,
  message,
  page,
  submittedAt = new Date(),
}) => {
  const safeName = escapeHtml(userName);
  const safeEmail = escapeHtml(userEmail);
  const safePage = page ? escapeHtml(page) : '';
  const safeMessage = message ? escapeHtml(message) : '';

  const moodEmojis = {
    loved: '\u{1F60D}',
    happy: '\u{1F60A}',
    neutral: '\u{1F610}',
    confused: '\u{1F615}',
    sad: '\u{1F622}',
  };
  const moodEmoji = moodEmojis[mood] || mood;

  const html = `
    <h3 style="color: #111827; margin-top: 0;">New Feedback Received</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr>
        <td style="padding: 8px 12px; color: #6b7280; font-size: 14px; width: 80px;">From</td>
        <td style="padding: 8px 12px; color: #374151; font-weight: 600;">${safeName} (${safeEmail})</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; color: #6b7280; font-size: 14px;">Mood</td>
        <td style="padding: 8px 12px; font-size: 20px;">${moodEmoji} ${mood}</td>
      </tr>
      ${page ? `<tr><td style="padding: 8px 12px; color: #6b7280; font-size: 14px;">Page</td><td style="padding: 8px 12px; color: #374151;">${safePage}</td></tr>` : ''}
      ${message ? `<tr><td style="padding: 8px 12px; color: #6b7280; font-size: 14px; vertical-align: top;">Message</td><td style="padding: 8px 12px; color: #374151; line-height: 1.6;">${safeMessage}</td></tr>` : ''}
    </table>
    <p style="color: #9ca3af; font-size: 12px;">
      Submitted at ${submittedAt.toUTCString()}
    </p>
  `;

  return {
    subject: `Feedback: ${moodEmoji} from ${safeName}`,
    html,
    label: 'Feedback notification',
  };
};

export const buildEmailVerificationEmail = ({ name, code }) => {
  const html = `
    <h3 style="color: #111827; margin-top: 0;">Verify Your Email</h3>
    <p style="color: #374151; line-height: 1.6;">
      Hi ${escapeHtml(name)}, enter the following code to verify your email address and enable email notifications:
    </p>
    <div style="text-align: center; margin: 24px 0;">
      <span style="display: inline-block; padding: 16px 32px; background-color: #f3f4f6; border-radius: 8px; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111827;">${escapeHtml(code)}</span>
    </div>
    <p style="color: #6b7280; font-size: 14px;">
      This code expires in <strong>10 minutes</strong>. If you didn't request this, you can safely ignore this email.
    </p>
  `;

  return {
    subject: 'Verify your email \u2014 Habit Tracker',
    html,
    label: 'Email verification',
  };
};

export const buildDailyReminderEmail = ({ name, habits, clientUrl }) => {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const habitList = habits
    .map((h) => `<li style="padding: 4px 0;">${escapeHtml(h.icon || '\u{1F3AF}')} <strong>${escapeHtml(h.name)}</strong>${h.target > 1 ? ` \u2014 target: ${h.target} ${escapeHtml(h.unit || '')}` : ''}</li>`)
    .join('');

  const html = `
    <h3 style="color: #111827; margin-top: 0;">Your Habits for Today</h3>
    <p style="color: #374151; line-height: 1.6;">
      Hi ${escapeHtml(name)}, you have <strong>${habits.length} habit${habits.length > 1 ? 's' : ''}</strong> to complete today:
    </p>
    <ul style="color: #374151; line-height: 1.8; padding-left: 20px;">
      ${habitList}
    </ul>
    <a href="${clientUrl}/" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
      Go to Today
    </a>
    <p style="color: #9ca3af; font-size: 12px;">${today}</p>
  `;

  return {
    subject: `Your habits for today \u2014 ${today}`,
    html,
    label: 'Daily reminder',
  };
};

export const buildStreakMilestoneEmail = ({ name, habitName, streak, clientUrl }) => {
  const milestoneMessages = {
    7: "That's a full week! You're building a real habit.",
    14: "Two weeks strong! Consistency is paying off.",
    21: "Three weeks! Science says this is when habits stick.",
    30: "A whole month! You're unstoppable.",
    50: "50 days! That's seriously impressive dedication.",
    100: "Triple digits! You're in elite habit territory.",
    200: "200 days! This is truly part of who you are.",
    365: "A full year! What an incredible achievement!",
  };
  const message = milestoneMessages[streak] || `${streak} days of consistency!`;

  const html = `
    <h3 style="color: #111827; margin-top: 0;">\u{1F525} ${streak}-Day Streak!</h3>
    <p style="color: #374151; line-height: 1.6;">
      Hi ${escapeHtml(name)}, you've completed <strong>"${escapeHtml(habitName)}"</strong> for <strong>${streak} days</strong> in a row!
    </p>
    <div style="background-color: #eef2ff; border-left: 4px solid #6366f1; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
      <p style="color: #4338ca; font-size: 14px; margin: 0;">
        ${message}
      </p>
    </div>
    <a href="${clientUrl}/" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
      Keep Going
    </a>
  `;

  return {
    subject: `You hit a ${streak}-day streak on ${escapeHtml(habitName)}!`,
    html,
    label: 'Streak milestone',
  };
};

export const buildGoalCompletionEmail = ({ name, habitName, value, target, unit, clientUrl }) => {
  const displayValue = unit ? `${value}/${target} ${escapeHtml(unit)}` : 'Done';

  const html = `
    <h3 style="color: #111827; margin-top: 0;">\u2705 Goal Achieved!</h3>
    <p style="color: #374151; line-height: 1.6;">
      Hi ${escapeHtml(name)}, you completed <strong>"${escapeHtml(habitName)}"</strong> today!
    </p>
    <div style="text-align: center; margin: 20px 0;">
      <span style="display: inline-block; padding: 12px 24px; background-color: #ecfdf5; border-radius: 8px; font-size: 20px; font-weight: 700; color: #065f46;">${displayValue}</span>
    </div>
    <a href="${clientUrl}/" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
      View Your Progress
    </a>
  `;

  return {
    subject: `You completed "${escapeHtml(habitName)}" today!`,
    html,
    label: 'Goal completion',
  };
};

export const buildMissedHabitEmail = ({ name, missedHabits, clientUrl }) => {
  const count = missedHabits.length;
  const habitList = missedHabits
    .map((h) => {
      const streakInfo = h.currentStreak > 0 ? ` \u2014 <span style="color: #dc2626;">${h.currentStreak}-day streak at risk!</span>` : '';
      return `<li style="padding: 4px 0;">${escapeHtml(h.icon || '\u{1F3AF}')} <strong>${escapeHtml(h.name)}</strong>${streakInfo}</li>`;
    })
    .join('');

  const html = `
    <h3 style="color: #111827; margin-top: 0;">Missed Habits Yesterday</h3>
    <p style="color: #374151; line-height: 1.6;">
      Hi ${escapeHtml(name)}, you missed <strong>${count} habit${count > 1 ? 's' : ''}</strong> yesterday:
    </p>
    <ul style="color: #374151; line-height: 1.8; padding-left: 20px;">
      ${habitList}
    </ul>
    <div style="background-color: #eef2ff; border-left: 4px solid #6366f1; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
      <p style="color: #4338ca; font-size: 14px; margin: 0;">
        It's okay to miss a day \u2014 what matters is getting back on track. You've got this!
      </p>
    </div>
    <a href="${clientUrl}/" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
      Log Today's Habits
    </a>
  `;

  return {
    subject: `You missed ${count} habit${count > 1 ? 's' : ''} yesterday`,
    html,
    label: 'Missed habit alert',
  };
};

export const buildWeeklySummaryEmail = ({ name, completionRate, completed, total, bestHabit, bestStreak, clientUrl }) => {
  const html = `
    <h3 style="color: #111827; margin-top: 0;">Your Week in Review</h3>
    <p style="color: #374151; line-height: 1.6;">
      Hi ${escapeHtml(name)}, here's how your week went:
    </p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr>
        <td style="padding: 12px; background-color: #f3f4f6; border-radius: 8px 0 0 0; text-align: center; width: 50%;">
          <div style="font-size: 28px; font-weight: 700; color: #6366f1;">${completionRate}%</div>
          <div style="color: #6b7280; font-size: 12px;">Completion Rate</div>
        </td>
        <td style="padding: 12px; background-color: #f3f4f6; border-radius: 0 8px 0 0; text-align: center; width: 50%;">
          <div style="font-size: 28px; font-weight: 700; color: #111827;">${completed}/${total}</div>
          <div style="color: #6b7280; font-size: 12px;">Habits Completed</div>
        </td>
      </tr>
    </table>
    ${bestHabit ? `
    <div style="background-color: #eef2ff; border-left: 4px solid #6366f1; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
      <p style="color: #4338ca; font-size: 14px; margin: 0;">
        \u{1F525} Best streak: <strong>${escapeHtml(bestHabit)}</strong> (${bestStreak} days)
      </p>
    </div>
    ` : ''}
    <a href="${clientUrl}/" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
      View Full Stats
    </a>
  `;

  return {
    subject: `Your week in review \u2014 ${completionRate}% completion`,
    html,
    label: 'Weekly summary',
  };
};

export const buildPasswordChangedEmail = ({ name, submittedAt = new Date() }) => {
  const html = `
    <h3 style="color: #111827; margin-top: 0;">Password Changed</h3>
    <p style="color: #374151; line-height: 1.6;">
      Hi ${escapeHtml(name)}, your Habit Tracker password was changed successfully from your account settings.
    </p>
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
      <p style="color: #92400e; font-size: 14px; margin: 0;">
        <strong>Didn't change your password?</strong> If you didn't make this change, please reset your password immediately using the forgot password flow.
      </p>
    </div>
    <p style="color: #6b7280; font-size: 14px;">
      Time: ${submittedAt.toUTCString()}
    </p>
  `;

  return {
    subject: 'Your Habit Tracker password was changed',
    html,
    label: 'Password changed',
  };
};
