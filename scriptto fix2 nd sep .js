'use strict';
/* Edited: functionality preserved */

// ---- SUPABASE CONFIG ----
const SUPABASE_URL = "https://lzuqaaspspvtwlztqvob.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6dXFhYXNwc3B2dHdsenRxdm9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjYyMjgsImV4cCI6MjEwMDg0MjIyOH0.Slleo6y4cOAOa8KrIlDuPzct1XmiE7UACLFz-39J0SY";

const supabaseClient = (SUPABASE_URL.indexOf("YOUR_") !== 0 && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

let currentUserId = null;
let supabaseReady = null; // promise that resolves once auth + initial data is loaded
let loveCounts = {};    // artist_name -> total number of loves (all visitors)
let commentCounts = {}; // artist_name -> total number of comments (all visitors)
let visitCounts = {};   // venue -> total number of visitors who marked it visited

// Every visitor gets a persistent anonymous Supabase auth user the first time
// they open the trail. The resulting user id is what loves/visits/comments
// are stored against, and it is remembered locally so the same browser keeps
// its data across visits (before/without entering an email).
async function initSupabase(){
  if(!supabaseClient) {
    console.warn("Supabase is not configured yet — feedback (loves/comments/visited) will not be saved. Fill in SUPABASE_URL and SUPABASE_ANON_KEY in script.js.");
    return;
  }
  try {
    let { data: { session } } = await supabaseClient.auth.getSession();
    if(!session){
      const { data, error } = await supabaseClient.auth.signInAnonymously();
      if(error) throw error;
      session = data.session;
    }
    currentUserId = session.user.id;
    await Promise.all([loadUserFeedbackState(), loadFeedbackCounts()]);
  } catch(err){
    console.error("Supabase init failed:", err);
  }
}

// Pull this visitor's existing loves + visited venues from Supabase so their
// state is restored on this device/browser (e.g. after a page refresh).
async function loadUserFeedbackState(){
  if(!supabaseClient || !currentUserId) return;
  const [lovesRes, visitsRes] = await Promise.all([
    supabaseClient.from("loves").select("artist_name").eq("user_id", currentUserId),
    supabaseClient.from("visits").select("venue").eq("user_id", currentUserId)
  ]);
  if(!lovesRes.error && lovesRes.data){
    lovesRes.data.forEach(function(row){ lovedStudios[row.artist_name] = true; });
  }
  if(!visitsRes.error && visitsRes.data){
    visitedVenues = visitsRes.data.map(function(row){ return row.venue; });
  }
}

// Pull the public, aggregate love/comment/visit counts (across every
// visitor) so they can be shown on the buttons, e.g. "❤️ Love (12)" /
// "✓ Visited (34)". Requires the *_counts views + grants from
// supabase_schema.sql / supabase_schema_add_counts.sql.
async function loadFeedbackCounts(){
  if(!supabaseClient) return;
  const [loveRes, commentRes, visitRes] = await Promise.all([
    supabaseClient.from("love_counts").select("artist_name, loves"),
    supabaseClient.from("comment_counts").select("artist_name, comments"),
    supabaseClient.from("visit_counts").select("venue, visits")
  ]);
  if(!loveRes.error && loveRes.data){
    loveCounts = {};
    loveRes.data.forEach(function(row){ loveCounts[row.artist_name] = row.loves; });
  } else if(loveRes.error){
    console.error("love counts fetch failed:", loveRes.error);
  }
  if(!commentRes.error && commentRes.data){
    commentCounts = {};
    commentRes.data.forEach(function(row){ commentCounts[row.artist_name] = row.comments; });
  } else if(commentRes.error){
    console.error("comment counts fetch failed:", commentRes.error);
  }
  if(!visitRes.error && visitRes.data){
    visitCounts = {};
    visitRes.data.forEach(function(row){ visitCounts[row.venue] = row.visits; });
  } else if(visitRes.error){
    console.error("visit counts fetch failed:", visitRes.error);
  }
}

// ---- Lightweight usage analytics ----
// Fire-and-forget inserts into the `events` table (see
// supabase_schema_events.sql). Never blocks the UI and never throws.
function detectDevice(){
  const ua = navigator.userAgent || "";
  if(/tablet|ipad/i.test(ua)) return "tablet";
  if(/mobi|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}

function logEvent(eventType, target, meta){
  if(!supabaseClient || !currentUserId) return;
  supabaseClient.from("events").insert({
    user_id: currentUserId,
    event_type: eventType,
    target: target || null,
    meta: meta || null
  }).then(function(res){ if(res.error) console.error("event log failed:", eventType, res.error); });
}

function loveButtonLabel(artistName){
  const n = loveCounts[artistName] || 0;
  return "\u2764\ufe0f Love" + (n > 0 ? " (" + n + ")" : "");
}
function commentButtonLabel(artistName){
  const n = commentCounts[artistName] || 0;
  return "\ud83d\udcac Comment" + (n > 0 ? " (" + n + ")" : "");
}
function visitButtonLabel(venueNum, isVisited){
  const n = visitCounts[venueNum] || 0;
  const base = isVisited ? "\u2713 Visited" : "Mark Visited";
  return base + (n > 0 ? " (" + n + ")" : "");
}
// ---- TRAIL DATA (real HVA Open Studios 2026 data, parsed from WordPress export) ----
const locations = [
  { venue:"1", lat:51.8252911, lng:-0.7069222, days:{ 5:{"Lynne Bruges":"11am-5pm"},6:{"Lynne Bruges":"11am-5pm"},10:{"Lynne Bruges":"11am-5pm"},11:{"Lynne Bruges":"11am-5pm"},12:{"Lynne Bruges":"11am-5pm"},13:{"Lynne Bruges":"11am-5pm"},17:{"Lynne Bruges":"11am-5pm"},18:{"Lynne Bruges":"11am-5pm"},19:{"Lynne Bruges":"11am-5pm"},20:{"Lynne Bruges":"11am-5pm"},24:{"Lynne Bruges":"11am-5pm"},25:{"Lynne Bruges":"11am-5pm"},26:{"Lynne Bruges":"11am-5pm"},27:{"Lynne Bruges":"11am-5pm"} } },
  { venue:"2", lat:51.7851148, lng:-0.6451114, siteName:"Art at Oddy", days:{ 11:{"Liz Grammenos":"11am-5pm","Jenny Thompson":"11am-5pm"},12:{"Liz Grammenos":"11am-5pm","Jenny Thompson":"11am-5pm"},13:{"Liz Grammenos":"11am-5pm","Jenny Thompson":"11am-5pm"},18:{"Liz Grammenos":"11am-5pm","Jenny Thompson":"11am-5pm"},19:{"Liz Grammenos":"11am-5pm","Jenny Thompson":"11am-5pm"},20:{"Liz Grammenos":"11am-5pm","Jenny Thompson":"11am-5pm"},25:{"Liz Grammenos":"11am-5pm","Jenny Thompson":"11am-5pm"},26:{"Liz Grammenos":"11am-5pm","Jenny Thompson":"11am-5pm"},27:{"Liz Grammenos":"11am-5pm","Jenny Thompson":"11am-5pm"} } },
  { venue:"3", lat:51.781525, lng:-0.58186, days:{ 17:{"Artists at Hill Farm Barn":"10am-4pm"},18:{"Artists at Hill Farm Barn":"10am-4pm"},19:{"Artists at Hill Farm Barn":"10am-4pm"},20:{"Artists at Hill Farm Barn":"10am-4pm"} } },
  { venue:"4", lat:51.7647564, lng:-0.5789004, siteName:"Artists at Lagley Meadow Hall", days:{ 17:{"Elspeth Hector":"10am-4pm","Susan Chester":"10am-4pm","Lagley Meadow Hall Group":"10am-4pm"},18:{"Elspeth Hector":"10am-4pm","Susan Chester":"10am-4pm","Lagley Meadow Hall Group":"10am-4pm"},19:{"Elspeth Hector":"10am-4pm","Susan Chester":"10am-4pm","Lagley Meadow Hall Group":"10am-4pm"},20:{"Elspeth Hector":"10am-4pm","Susan Chester":"10am-4pm","Lagley Meadow Hall Group":"10am-4pm"} } },
  { venue:"5", lat:51.7600282, lng:-0.5638788, siteName:"Artists at the Civic Centre", days:{ 17:{"Civic Centre Group":"10am-4pm (Thu 5pm-8pm)","Brigid Marlin & Friends":"10am-4pm (Thu 5pm-8pm)","Buckinghamshire Craft Guild":"10am-4pm (Thu 5pm-8pm)","Mary Casserley":"10am-4pm (Thu 5pm-8pm)","Paula Davies-Smith":"10am-4pm (Thu 5pm-8pm)"},18:{"Civic Centre Group":"10am-4pm (Thu 5pm-8pm)","Brigid Marlin & Friends":"10am-4pm (Thu 5pm-8pm)","Buckinghamshire Craft Guild":"10am-4pm (Thu 5pm-8pm)","Mary Casserley":"10am-4pm (Thu 5pm-8pm)","Paula Davies-Smith":"10am-4pm (Thu 5pm-8pm)"},19:{"Civic Centre Group":"10am-4pm (Thu 5pm-8pm)","Brigid Marlin & Friends":"10am-4pm (Thu 5pm-8pm)","Buckinghamshire Craft Guild":"10am-4pm (Thu 5pm-8pm)","Mary Casserley":"10am-4pm (Thu 5pm-8pm)","Paula Davies-Smith":"10am-4pm (Thu 5pm-8pm)"},20:{"Civic Centre Group":"10am-4pm (Thu 5pm-8pm)","Brigid Marlin & Friends":"10am-4pm (Thu 5pm-8pm)","Buckinghamshire Craft Guild":"10am-4pm (Thu 5pm-8pm)","Mary Casserley":"10am-4pm (Thu 5pm-8pm)","Paula Davies-Smith":"10am-4pm (Thu 5pm-8pm)"} } },
  { venue:"6", lat:51.7618635, lng:-0.5497289, days:{ 12:{"Mitzie Green":"12noon-5pm"},13:{"Mitzie Green":"12noon-5pm"},19:{"Mitzie Green":"12noon-5pm"},20:{"Mitzie Green":"12noon-5pm"},26:{"Mitzie Green":"12noon-5pm"},27:{"Mitzie Green":"12noon-5pm"} } },
  { venue:"7", lat:51.7591, lng:-0.4721, siteName:"Hemel Hempstead Old Town Hall Group", days:{ 5:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},6:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},7:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},8:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},9:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},10:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},11:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},12:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},13:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},14:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},15:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},16:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},17:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},18:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},19:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},20:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},21:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},22:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},23:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},24:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},25:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},26:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"},27:{"Carolyn Storey":"11am-5pm (contact artist for when she's present)","Linda-Gail":"11am-5pm (email artist for when she's present)","Pete Greening":"11am-5pm (artist present Mon/Wed/Fri & other times)"} } },
  { venue:"8", lat:51.7639179, lng:-0.3435982, days:{ 12:{"Jenny Robinson":"10am-5pm"},13:{"Jenny Robinson":"10am-5pm"},19:{"Jenny Robinson":"10am-5pm"},20:{"Jenny Robinson":"10am-5pm"} } },
  { venue:"9", lat:51.755236840709, lng:-0.35169258033924, siteName:"Kingsbury Artists (Group 1)", days:{ 16:{"Debbie Knight":"10am-4pm (Thu/Mon 11am-3pm)","Amanda Xuereb":"10am-4pm (Thu/Mon 11am-3pm)","Cal Hoy":"10am-4pm (Thu/Mon 11am-3pm)","Miroslav Mijatovic":"10am-4pm (Thu/Mon 11am-3pm)","Gabrielle Felton":"10am-4pm (Thu/Mon 11am-3pm)","Lisa Reissner":"10am-4pm (Thu/Mon 11am-3pm)","Lottie Clarke":"10am-4pm (Thu/Mon 11am-3pm)","Irene Maye":"10am-4pm (Thu/Mon 11am-3pm)","Bob Notley":"10am-4pm (Thu/Mon 11am-3pm)","Maddy Eaton":"10am-4pm (Thu/Mon 11am-3pm)"},17:{"Debbie Knight":"10am-4pm (Thu/Mon 11am-3pm)","Amanda Xuereb":"10am-4pm (Thu/Mon 11am-3pm)","Cal Hoy":"10am-4pm (Thu/Mon 11am-3pm)","Miroslav Mijatovic":"10am-4pm (Thu/Mon 11am-3pm)","Gabrielle Felton":"10am-4pm (Thu/Mon 11am-3pm)","Lisa Reissner":"10am-4pm (Thu/Mon 11am-3pm)","Lottie Clarke":"10am-4pm (Thu/Mon 11am-3pm)","Irene Maye":"10am-4pm (Thu/Mon 11am-3pm)","Bob Notley":"10am-4pm (Thu/Mon 11am-3pm)","Maddy Eaton":"10am-4pm (Thu/Mon 11am-3pm)"},18:{"Debbie Knight":"10am-4pm (Thu/Mon 11am-3pm)","Amanda Xuereb":"10am-4pm (Thu/Mon 11am-3pm)","Cal Hoy":"10am-4pm (Thu/Mon 11am-3pm)","Miroslav Mijatovic":"10am-4pm (Thu/Mon 11am-3pm)","Gabrielle Felton":"10am-4pm (Thu/Mon 11am-3pm)","Lisa Reissner":"10am-4pm (Thu/Mon 11am-3pm)","Lottie Clarke":"10am-4pm (Thu/Mon 11am-3pm)","Irene Maye":"10am-4pm (Thu/Mon 11am-3pm)","Bob Notley":"10am-4pm (Thu/Mon 11am-3pm)","Maddy Eaton":"10am-4pm (Thu/Mon 11am-3pm)"},19:{"Debbie Knight":"10am-4pm (Thu/Mon 11am-3pm)","Amanda Xuereb":"10am-4pm (Thu/Mon 11am-3pm)","Cal Hoy":"10am-4pm (Thu/Mon 11am-3pm)","Miroslav Mijatovic":"10am-4pm (Thu/Mon 11am-3pm)","Gabrielle Felton":"10am-4pm (Thu/Mon 11am-3pm)","Lisa Reissner":"10am-4pm (Thu/Mon 11am-3pm)","Lottie Clarke":"10am-4pm (Thu/Mon 11am-3pm)","Irene Maye":"10am-4pm (Thu/Mon 11am-3pm)","Bob Notley":"10am-4pm (Thu/Mon 11am-3pm)","Maddy Eaton":"10am-4pm (Thu/Mon 11am-3pm)"},20:{"Debbie Knight":"10am-4pm (Thu/Mon 11am-3pm)","Amanda Xuereb":"10am-4pm (Thu/Mon 11am-3pm)","Cal Hoy":"10am-4pm (Thu/Mon 11am-3pm)","Miroslav Mijatovic":"10am-4pm (Thu/Mon 11am-3pm)","Gabrielle Felton":"10am-4pm (Thu/Mon 11am-3pm)","Lisa Reissner":"10am-4pm (Thu/Mon 11am-3pm)","Lottie Clarke":"10am-4pm (Thu/Mon 11am-3pm)","Irene Maye":"10am-4pm (Thu/Mon 11am-3pm)","Bob Notley":"10am-4pm (Thu/Mon 11am-3pm)","Maddy Eaton":"10am-4pm (Thu/Mon 11am-3pm)"},21:{"Debbie Knight":"10am-4pm (Thu/Mon 11am-3pm)","Amanda Xuereb":"10am-4pm (Thu/Mon 11am-3pm)","Cal Hoy":"10am-4pm (Thu/Mon 11am-3pm)","Miroslav Mijatovic":"10am-4pm (Thu/Mon 11am-3pm)","Gabrielle Felton":"10am-4pm (Thu/Mon 11am-3pm)","Lisa Reissner":"10am-4pm (Thu/Mon 11am-3pm)","Lottie Clarke":"10am-4pm (Thu/Mon 11am-3pm)","Irene Maye":"10am-4pm (Thu/Mon 11am-3pm)","Bob Notley":"10am-4pm (Thu/Mon 11am-3pm)","Maddy Eaton":"10am-4pm (Thu/Mon 11am-3pm)"} } },
  { venue:"10", lat:51.755225493287, lng:-0.35177501230315, siteName:"Kingsbury Artists (Group 2)", days:{ 24:{"Sabine Riechmann (Sabijoux Design)":"10am-5pm (Sat 10am-7pm)","Fiona Ryan-Watson":"10am-5pm (Sat 10am-7pm)","Barbara Burrows":"10am-5pm (Sat 10am-7pm)","Laura Murgia":"10am-5pm (Sat 10am-7pm)","Rosie Elizabeth Barker":"10am-5pm (Sat 10am-7pm)","Jackie O'Keeffe":"10am-5pm (Sat 10am-7pm)","Hazel Russell":"10am-5pm (Sat 10am-7pm)","Abigail Lagden (Curiously Contrary)":"10am-5pm (Sat 10am-7pm)","Mirna Una Majer":"10am-5pm (Sat 10am-7pm)","Jaiya Bhandari":"10am-5pm (Sat 10am-7pm)"},25:{"Sabine Riechmann (Sabijoux Design)":"10am-5pm (Sat 10am-7pm)","Fiona Ryan-Watson":"10am-5pm (Sat 10am-7pm)","Barbara Burrows":"10am-5pm (Sat 10am-7pm)","Laura Murgia":"10am-5pm (Sat 10am-7pm)","Rosie Elizabeth Barker":"10am-5pm (Sat 10am-7pm)","Jackie O'Keeffe":"10am-5pm (Sat 10am-7pm)","Hazel Russell":"10am-5pm (Sat 10am-7pm)","Abigail Lagden (Curiously Contrary)":"10am-5pm (Sat 10am-7pm)","Mirna Una Majer":"10am-5pm (Sat 10am-7pm)","Jaiya Bhandari":"10am-5pm (Sat 10am-7pm)"},26:{"Sabine Riechmann (Sabijoux Design)":"10am-5pm (Sat 10am-7pm)","Fiona Ryan-Watson":"10am-5pm (Sat 10am-7pm)","Barbara Burrows":"10am-5pm (Sat 10am-7pm)","Laura Murgia":"10am-5pm (Sat 10am-7pm)","Rosie Elizabeth Barker":"10am-5pm (Sat 10am-7pm)","Jackie O'Keeffe":"10am-5pm (Sat 10am-7pm)","Hazel Russell":"10am-5pm (Sat 10am-7pm)","Abigail Lagden (Curiously Contrary)":"10am-5pm (Sat 10am-7pm)","Mirna Una Majer":"10am-5pm (Sat 10am-7pm)","Jaiya Bhandari":"10am-5pm (Sat 10am-7pm)"},27:{"Sabine Riechmann (Sabijoux Design)":"10am-5pm (Sat 10am-7pm)","Fiona Ryan-Watson":"10am-5pm (Sat 10am-7pm)","Barbara Burrows":"10am-5pm (Sat 10am-7pm)","Laura Murgia":"10am-5pm (Sat 10am-7pm)","Rosie Elizabeth Barker":"10am-5pm (Sat 10am-7pm)","Jackie O'Keeffe":"10am-5pm (Sat 10am-7pm)","Hazel Russell":"10am-5pm (Sat 10am-7pm)","Abigail Lagden (Curiously Contrary)":"10am-5pm (Sat 10am-7pm)","Mirna Una Majer":"10am-5pm (Sat 10am-7pm)","Jaiya Bhandari":"10am-5pm (Sat 10am-7pm)"} } },
  { venue:"11", lat:51.751561875605, lng:-0.3477096943789, days:{ 10:{"One Creative Ape":"10.30am-6pm"},11:{"One Creative Ape":"10.30am-6pm"},12:{"One Creative Ape":"10.30am-6pm"},13:{"One Creative Ape":"10.30am-6pm"},19:{"One Creative Ape":"10.30am-6pm"},20:{"One Creative Ape":"10.30am-6pm"} } },
  { venue:"12", lat:51.7512145, lng:-0.3412278, days:{ 5:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},6:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},7:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},8:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},9:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},10:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},11:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},12:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},13:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},14:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},15:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},16:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},17:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},18:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},19:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},20:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},21:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},22:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},23:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},24:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},25:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},26:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"},27:{"Philippa Bicknell":"10am-5.30pm (Sun 11am - 5pm)"} } },
  { venue:"13", lat:51.7482413, lng:-0.3366358, days:{ 5:{"Bob Goodall":"2pm-6pm"},6:{"Bob Goodall":"2pm-6pm"},9:{"Bob Goodall":"2pm-6pm"},11:{"Bob Goodall":"2pm-6pm"},12:{"Bob Goodall":"2pm-6pm"},13:{"Bob Goodall":"2pm-6pm"},16:{"Bob Goodall":"2pm-6pm"},18:{"Bob Goodall":"2pm-6pm"},19:{"Bob Goodall":"2pm-6pm"},20:{"Bob Goodall":"2pm-6pm"},23:{"Bob Goodall":"2pm-6pm"},25:{"Bob Goodall":"2pm-6pm"},26:{"Bob Goodall":"2pm-6pm"},27:{"Bob Goodall":"2pm-6pm"} } },
  { venue:"14", lat:51.7439009, lng:-0.3199281, days:{ 12:{"AnnaSilvia Dooley":"2pm-5pm (Sat 12th, 2pm-7pm)"},13:{"AnnaSilvia Dooley":"2pm-5pm (Sat 12th, 2pm-7pm)"},14:{"AnnaSilvia Dooley":"2pm-5pm (Sat 12th, 2pm-7pm)"},26:{"AnnaSilvia Dooley":"2pm-5pm (Sat 12th, 2pm-7pm)"},27:{"AnnaSilvia Dooley":"2pm-5pm (Sat 12th, 2pm-7pm)"} } },
  { venue:"15", lat:51.7417437, lng:-0.3144419, days:{ 15:{"Jessica Ozlo":"11am-4pm (Thu 4pm-8pm)"},16:{"Jessica Ozlo":"11am-4pm (Thu 4pm-8pm)"},17:{"Jessica Ozlo":"11am-4pm (Thu 4pm-8pm)"},19:{"Jessica Ozlo":"11am-4pm (Thu 4pm-8pm)"},22:{"Jessica Ozlo":"11am-4pm (Thu 4pm-8pm)"},23:{"Jessica Ozlo":"11am-4pm (Thu 4pm-8pm)"},24:{"Jessica Ozlo":"11am-4pm (Thu 4pm-8pm)"},26:{"Jessica Ozlo":"11am-4pm (Thu 4pm-8pm)"} } },
  { venue:"16", lat:51.747198, lng:-0.299659, days:{ 5:{"Tg Art (Toni Gates)":"9am-5.30pm (Tues 9am-5pm, Sat 9am-2pm)"},7:{"Tg Art (Toni Gates)":"9am-5.30pm (Tues 9am-5pm, Sat 9am-2pm)"},8:{"Tg Art (Toni Gates)":"9am-5.30pm (Tues 9am-5pm, Sat 9am-2pm)"},9:{"Tg Art (Toni Gates)":"9am-5.30pm (Tues 9am-5pm, Sat 9am-2pm)"},10:{"Tg Art (Toni Gates)":"9am-5.30pm (Tues 9am-5pm, Sat 9am-2pm)"},11:{"Tg Art (Toni Gates)":"9am-5.30pm (Tues 9am-5pm, Sat 9am-2pm)"},12:{"Tg Art (Toni Gates)":"9am-5.30pm (Tues 9am-5pm, Sat 9am-2pm)"},14:{"Tg Art (Toni Gates)":"9am-5.30pm (Tues 9am-5pm, Sat 9am-2pm)"},15:{"Tg Art (Toni Gates)":"9am-5.30pm (Tues 9am-5pm, Sat 9am-2pm)"},16:{"Tg Art (Toni Gates)":"9am-5.30pm (Tues 9am-5pm, Sat 9am-2pm)"},17:{"Tg Art (Toni Gates)":"9am-5.30pm (Tues 9am-5pm, Sat 9am-2pm)"},18:{"Tg Art (Toni Gates)":"9am-5.30pm (Tues 9am-5pm, Sat 9am-2pm)"},19:{"Tg Art (Toni Gates)":"9am-5.30pm (Tues 9am-5pm, Sat 9am-2pm)"},21:{"Tg Art (Toni Gates)":"9am-5.30pm (Tues 9am-5pm, Sat 9am-2pm)"},22:{"Tg Art (Toni Gates)":"9am-5.30pm (Tues 9am-5pm, Sat 9am-2pm)"},23:{"Tg Art (Toni Gates)":"9am-5.30pm (Tues 9am-5pm, Sat 9am-2pm)"},24:{"Tg Art (Toni Gates)":"9am-5.30pm (Tues 9am-5pm, Sat 9am-2pm)"},25:{"Tg Art (Toni Gates)":"9am-5.30pm (Tues 9am-5pm, Sat 9am-2pm)"},26:{"Tg Art (Toni Gates)":"9am-5.30pm (Tues 9am-5pm, Sat 9am-2pm)"} } },
  { venue:"17", lat:51.7482318, lng:-0.3109812, days:{ 5:{"Marta Nicholson":"11am-5pm (Wed/Thu 5pm-7.30pm)"},9:{"Marta Nicholson":"11am-5pm (Wed/Thu 5pm-7.30pm)"},12:{"Marta Nicholson":"11am-5pm (Wed/Thu 5pm-7.30pm)"},13:{"Marta Nicholson":"11am-5pm (Wed/Thu 5pm-7.30pm)"},16:{"Marta Nicholson":"11am-5pm (Wed/Thu 5pm-7.30pm)"},17:{"Marta Nicholson":"11am-5pm (Wed/Thu 5pm-7.30pm)"},19:{"Marta Nicholson":"11am-5pm (Wed/Thu 5pm-7.30pm)"},20:{"Marta Nicholson":"11am-5pm (Wed/Thu 5pm-7.30pm)"},23:{"Marta Nicholson":"11am-5pm (Wed/Thu 5pm-7.30pm)"},24:{"Marta Nicholson":"11am-5pm (Wed/Thu 5pm-7.30pm)"},26:{"Marta Nicholson":"11am-5pm (Wed/Thu 5pm-7.30pm)"} } },
  { venue:"18", lat:51.756994, lng:-0.3094829, days:{ 5:{"Judith Moule":"10.30am-5 pm"},6:{"Judith Moule":"10.30am-5 pm"},12:{"Judith Moule":"10.30am-5 pm"},13:{"Judith Moule":"10.30am-5 pm"},19:{"Judith Moule":"10.30am-5 pm"},20:{"Judith Moule":"10.30am-5 pm"} } },
  { venue:"19", lat:51.7509469, lng:-0.3234637, days:{ 5:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},6:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},7:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},8:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},9:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},10:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},11:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},12:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},13:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},14:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},15:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},16:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},17:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},18:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},19:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},20:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},21:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},22:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},23:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},24:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},25:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},26:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"},27:{"Mandy Johnson":"8am-3pm (Sat/Sun 9am-3pm)"} } },
  { venue:"20", lat:51.7538815, lng:-0.3294822, days:{ 17:{"Gabriela Moad":"1pm-4pm"},18:{"Gabriela Moad":"1pm-4pm"},19:{"Gabriela Moad":"1pm-4pm"},20:{"Gabriela Moad":"1pm-4pm"},21:{"Gabriela Moad":"1pm-4pm"},22:{"Gabriela Moad":"1pm-4pm"},23:{"Gabriela Moad":"1pm-4pm"} } },
  { venue:"21", lat:51.7585116, lng:-0.3284014, days:{ 18:{"Fiona Booy":"Fri 5pm-7pm; Sat 1pm-5pm; Sun 11am-4pm"},19:{"Fiona Booy":"Fri 5pm-7pm; Sat 1pm-5pm; Sun 11am-4pm"},20:{"Fiona Booy":"Fri 5pm-7pm; Sat 1pm-5pm; Sun 11am-4pm"},25:{"Fiona Booy":"Fri 5pm-7pm; Sat 1pm-5pm; Sun 11am-4pm"},26:{"Fiona Booy":"Fri 5pm-7pm; Sat 1pm-5pm; Sun 11am-4pm"},27:{"Fiona Booy":"Fri 5pm-7pm; Sat 1pm-5pm; Sun 11am-4pm"} } },
  { venue:"22", lat:51.7624971, lng:-0.3231973, days:{ 5:{"Dave Nelson":"10am-6pm"},6:{"Dave Nelson":"10am-6pm"} } },
  { venue:"23", lat:51.7648458, lng:-0.3206062, days:{ 5:{"Carrie Cook":"10am-4pm"},6:{"Carrie Cook":"10am-4pm"},11:{"Carrie Cook":"10am-4pm"},12:{"Carrie Cook":"10am-4pm"},13:{"Carrie Cook":"10am-4pm"} } },
  { venue:"24", lat:51.7718725, lng:-0.3046642, days:{ 5:{"Gerry Wilmer":"11am-4.30pm"},6:{"Gerry Wilmer":"11am-4.30pm"},12:{"Gerry Wilmer":"11am-4.30pm"},13:{"Gerry Wilmer":"11am-4.30pm"},19:{"Gerry Wilmer":"11am-4.30pm"},20:{"Gerry Wilmer":"11am-4.30pm"},26:{"Gerry Wilmer":"11am-4.30pm"},27:{"Gerry Wilmer":"11am-4.30pm"} } },
  { venue:"25", lat:51.8003815, lng:-0.3393672, siteName:"Wensley Arts", days:{ 5:{"Teresa Newham":"11am-4pm","Sue Wookey":"11am-4pm"},9:{"Teresa Newham":"11am-4pm","Sue Wookey":"11am-4pm"},12:{"Teresa Newham":"11am-4pm","Sue Wookey":"11am-4pm"},16:{"Teresa Newham":"11am-4pm","Sue Wookey":"11am-4pm"},19:{"Teresa Newham":"11am-4pm","Sue Wookey":"11am-4pm"},23:{"Teresa Newham":"11am-4pm","Sue Wookey":"11am-4pm"},26:{"Teresa Newham":"11am-4pm","Sue Wookey":"11am-4pm"} } },
  { venue:"26", lat:51.804455367213, lng:-0.35939202275391, days:{ 5:{"Diane Bedser":"12noon-5pm"},6:{"Diane Bedser":"12noon-5pm"},11:{"Diane Bedser":"12noon-5pm"},12:{"Diane Bedser":"12noon-5pm"},13:{"Diane Bedser":"12noon-5pm"},18:{"Diane Bedser":"12noon-5pm"},19:{"Diane Bedser":"12noon-5pm"},20:{"Diane Bedser":"12noon-5pm"} } },
  { venue:"27", lat:51.8126658, lng:-0.3564295, days:{ 5:{"Kat Herrgott-Penter":"10am-4.30pm"},8:{"Kat Herrgott-Penter":"10am-4.30pm"},9:{"Kat Herrgott-Penter":"10am-4.30pm"},10:{"Kat Herrgott-Penter":"10am-4.30pm"},11:{"Kat Herrgott-Penter":"10am-4.30pm"},12:{"Kat Herrgott-Penter":"10am-4.30pm"},15:{"Kat Herrgott-Penter":"10am-4.30pm"},16:{"Kat Herrgott-Penter":"10am-4.30pm"},17:{"Kat Herrgott-Penter":"10am-4.30pm"},18:{"Kat Herrgott-Penter":"10am-4.30pm"},19:{"Kat Herrgott-Penter":"10am-4.30pm"},22:{"Kat Herrgott-Penter":"10am-4.30pm"},23:{"Kat Herrgott-Penter":"10am-4.30pm"},24:{"Kat Herrgott-Penter":"10am-4.30pm"},25:{"Kat Herrgott-Penter":"10am-4.30pm"},26:{"Kat Herrgott-Penter":"10am-4.30pm"} } },
  { venue:"28", lat:51.8155576, lng:-0.3565262, siteName:"Studio 6", days:{ 7:{"Claire Pringle":"10am-5pm (Sun 11am-4pm)","Lesley Pollock":"10am-5pm (Sun 11am-4pm)","Sarah Coveney-Evans":"10am-5pm (Sun 11am-4pm)","Susan Lee Kerr":"10am-5pm (Sun 11am-4pm)","Kat Kerr":"10am-5pm (Sun 11am-4pm)","Jo Scott":"10am-5pm (Sun 11am-4pm)"},8:{"Claire Pringle":"10am-5pm (Sun 11am-4pm)","Lesley Pollock":"10am-5pm (Sun 11am-4pm)","Sarah Coveney-Evans":"10am-5pm (Sun 11am-4pm)","Susan Lee Kerr":"10am-5pm (Sun 11am-4pm)","Kat Kerr":"10am-5pm (Sun 11am-4pm)","Jo Scott":"10am-5pm (Sun 11am-4pm)"},9:{"Claire Pringle":"10am-5pm (Sun 11am-4pm)","Lesley Pollock":"10am-5pm (Sun 11am-4pm)","Sarah Coveney-Evans":"10am-5pm (Sun 11am-4pm)","Susan Lee Kerr":"10am-5pm (Sun 11am-4pm)","Kat Kerr":"10am-5pm (Sun 11am-4pm)","Jo Scott":"10am-5pm (Sun 11am-4pm)"},10:{"Claire Pringle":"10am-5pm (Sun 11am-4pm)","Lesley Pollock":"10am-5pm (Sun 11am-4pm)","Sarah Coveney-Evans":"10am-5pm (Sun 11am-4pm)","Susan Lee Kerr":"10am-5pm (Sun 11am-4pm)","Kat Kerr":"10am-5pm (Sun 11am-4pm)","Jo Scott":"10am-5pm (Sun 11am-4pm)"},11:{"Claire Pringle":"10am-5pm (Sun 11am-4pm)","Lesley Pollock":"10am-5pm (Sun 11am-4pm)","Sarah Coveney-Evans":"10am-5pm (Sun 11am-4pm)","Susan Lee Kerr":"10am-5pm (Sun 11am-4pm)","Kat Kerr":"10am-5pm (Sun 11am-4pm)","Jo Scott":"10am-5pm (Sun 11am-4pm)"},12:{"Claire Pringle":"10am-5pm (Sun 11am-4pm)","Lesley Pollock":"10am-5pm (Sun 11am-4pm)","Sarah Coveney-Evans":"10am-5pm (Sun 11am-4pm)","Susan Lee Kerr":"10am-5pm (Sun 11am-4pm)","Kat Kerr":"10am-5pm (Sun 11am-4pm)","Jo Scott":"10am-5pm (Sun 11am-4pm)"},13:{"Claire Pringle":"10am-5pm (Sun 11am-4pm)","Lesley Pollock":"10am-5pm (Sun 11am-4pm)","Sarah Coveney-Evans":"10am-5pm (Sun 11am-4pm)","Susan Lee Kerr":"10am-5pm (Sun 11am-4pm)","Kat Kerr":"10am-5pm (Sun 11am-4pm)","Jo Scott":"10am-5pm (Sun 11am-4pm)"} } },
  { venue:"29", lat:51.8155576, lng:-0.3565262, siteName:"Six Perspectives", days:{ 14:{"Felicity Cooke":"10am-5pm (Sun 10am-4pm)","Sarah Broughton":"10am-5pm (Sun 10am-4pm)","Paul Hunter":"10am-5pm (Sun 10am-4pm)","Danny Wilkins":"10am-5pm (Sun 10am-4pm)","Emily Rae":"10am-5pm (Sun 10am-4pm)","Ros McGuirk":"10am-5pm (Sun 10am-4pm)"},15:{"Felicity Cooke":"10am-5pm (Sun 10am-4pm)","Sarah Broughton":"10am-5pm (Sun 10am-4pm)","Paul Hunter":"10am-5pm (Sun 10am-4pm)","Danny Wilkins":"10am-5pm (Sun 10am-4pm)","Emily Rae":"10am-5pm (Sun 10am-4pm)","Ros McGuirk":"10am-5pm (Sun 10am-4pm)"},16:{"Felicity Cooke":"10am-5pm (Sun 10am-4pm)","Sarah Broughton":"10am-5pm (Sun 10am-4pm)","Paul Hunter":"10am-5pm (Sun 10am-4pm)","Danny Wilkins":"10am-5pm (Sun 10am-4pm)","Emily Rae":"10am-5pm (Sun 10am-4pm)","Ros McGuirk":"10am-5pm (Sun 10am-4pm)"},17:{"Felicity Cooke":"10am-5pm (Sun 10am-4pm)","Sarah Broughton":"10am-5pm (Sun 10am-4pm)","Paul Hunter":"10am-5pm (Sun 10am-4pm)","Danny Wilkins":"10am-5pm (Sun 10am-4pm)","Emily Rae":"10am-5pm (Sun 10am-4pm)","Ros McGuirk":"10am-5pm (Sun 10am-4pm)"},18:{"Felicity Cooke":"10am-5pm (Sun 10am-4pm)","Sarah Broughton":"10am-5pm (Sun 10am-4pm)","Paul Hunter":"10am-5pm (Sun 10am-4pm)","Danny Wilkins":"10am-5pm (Sun 10am-4pm)","Emily Rae":"10am-5pm (Sun 10am-4pm)","Ros McGuirk":"10am-5pm (Sun 10am-4pm)"},19:{"Felicity Cooke":"10am-5pm (Sun 10am-4pm)","Sarah Broughton":"10am-5pm (Sun 10am-4pm)","Paul Hunter":"10am-5pm (Sun 10am-4pm)","Danny Wilkins":"10am-5pm (Sun 10am-4pm)","Emily Rae":"10am-5pm (Sun 10am-4pm)","Ros McGuirk":"10am-5pm (Sun 10am-4pm)"},20:{"Felicity Cooke":"10am-5pm (Sun 10am-4pm)","Sarah Broughton":"10am-5pm (Sun 10am-4pm)","Paul Hunter":"10am-5pm (Sun 10am-4pm)","Danny Wilkins":"10am-5pm (Sun 10am-4pm)","Emily Rae":"10am-5pm (Sun 10am-4pm)","Ros McGuirk":"10am-5pm (Sun 10am-4pm)"} } },
  { venue:"30", lat:51.8155576, lng:-0.3565262, siteName:"The Six", days:{ 21:{"Sarah Lamb":"10am-5pm  (Sun 10am-4pm)","Hillary Taylor":"10am-5pm  (Sun 10am-4pm)","Judith Althea Fear":"10am-5pm  (Sun 10am-4pm)","Joanne Bowes":"10am-5pm  (Sun 10am-4pm)","Jon Hillier":"10am-5pm  (Sun 10am-4pm)","Ruth Sacks Ceramics":"10am-5pm  (Sun 10am-4pm)"},22:{"Sarah Lamb":"10am-5pm  (Sun 10am-4pm)","Hillary Taylor":"10am-5pm  (Sun 10am-4pm)","Judith Althea Fear":"10am-5pm  (Sun 10am-4pm)","Joanne Bowes":"10am-5pm  (Sun 10am-4pm)","Jon Hillier":"10am-5pm  (Sun 10am-4pm)","Ruth Sacks Ceramics":"10am-5pm  (Sun 10am-4pm)"},23:{"Sarah Lamb":"10am-5pm  (Sun 10am-4pm)","Hillary Taylor":"10am-5pm  (Sun 10am-4pm)","Judith Althea Fear":"10am-5pm  (Sun 10am-4pm)","Joanne Bowes":"10am-5pm  (Sun 10am-4pm)","Jon Hillier":"10am-5pm  (Sun 10am-4pm)","Ruth Sacks Ceramics":"10am-5pm  (Sun 10am-4pm)"},24:{"Sarah Lamb":"10am-5pm  (Sun 10am-4pm)","Hillary Taylor":"10am-5pm  (Sun 10am-4pm)","Judith Althea Fear":"10am-5pm  (Sun 10am-4pm)","Joanne Bowes":"10am-5pm  (Sun 10am-4pm)","Jon Hillier":"10am-5pm  (Sun 10am-4pm)","Ruth Sacks Ceramics":"10am-5pm  (Sun 10am-4pm)"},25:{"Sarah Lamb":"10am-5pm  (Sun 10am-4pm)","Hillary Taylor":"10am-5pm  (Sun 10am-4pm)","Judith Althea Fear":"10am-5pm  (Sun 10am-4pm)","Joanne Bowes":"10am-5pm  (Sun 10am-4pm)","Jon Hillier":"10am-5pm  (Sun 10am-4pm)","Ruth Sacks Ceramics":"10am-5pm  (Sun 10am-4pm)"},26:{"Sarah Lamb":"10am-5pm  (Sun 10am-4pm)","Hillary Taylor":"10am-5pm  (Sun 10am-4pm)","Judith Althea Fear":"10am-5pm  (Sun 10am-4pm)","Joanne Bowes":"10am-5pm  (Sun 10am-4pm)","Jon Hillier":"10am-5pm  (Sun 10am-4pm)","Ruth Sacks Ceramics":"10am-5pm  (Sun 10am-4pm)"},27:{"Sarah Lamb":"10am-5pm  (Sun 10am-4pm)","Hillary Taylor":"10am-5pm  (Sun 10am-4pm)","Judith Althea Fear":"10am-5pm  (Sun 10am-4pm)","Joanne Bowes":"10am-5pm  (Sun 10am-4pm)","Jon Hillier":"10am-5pm  (Sun 10am-4pm)","Ruth Sacks Ceramics":"10am-5pm  (Sun 10am-4pm)"} } },
  { venue:"31", lat:51.8167146, lng:-0.3561036, days:{ 7:{"Sue Peterson Mosaics":"9am-4pm"},8:{"Sue Peterson Mosaics":"9am-4pm"},9:{"Sue Peterson Mosaics":"9am-4pm"},10:{"Sue Peterson Mosaics":"9am-4pm"},11:{"Sue Peterson Mosaics":"9am-4pm"},12:{"Sue Peterson Mosaics":"9am-4pm"} } },
  { venue:"32", lat:51.8181954, lng:-0.3082099, days:{ 24:{"Gill Ayre":"11am-5.30pm"},25:{"Gill Ayre":"11am-5.30pm"},26:{"Gill Ayre":"11am-5.30pm"},27:{"Gill Ayre":"11am-5.30pm"} } },
  { venue:"33", lat:51.8766957, lng:-0.2811061, days:{ 18:{"Alex McIntyre & Friends":"11am-5pm"},19:{"Alex McIntyre & Friends":"11am-5pm"},20:{"Alex McIntyre & Friends":"11am-5pm"},25:{"Alex McIntyre & Friends":"11am-5pm"},26:{"Alex McIntyre & Friends":"11am-5pm"},27:{"Alex McIntyre & Friends":"11am-5pm"} } },
  { venue:"34", lat:51.877081646945, lng:-0.28018083390011, days:{ 5:{"Laura Donaldson":"10am-5pm"},6:{"Laura Donaldson":"10am-5pm"},10:{"Laura Donaldson":"10am-5pm"},11:{"Laura Donaldson":"10am-5pm"},12:{"Laura Donaldson":"10am-5pm"},13:{"Laura Donaldson":"10am-5pm"},17:{"Laura Donaldson":"10am-5pm"},18:{"Laura Donaldson":"10am-5pm"},19:{"Laura Donaldson":"10am-5pm"},20:{"Laura Donaldson":"10am-5pm"},24:{"Laura Donaldson":"10am-5pm"},25:{"Laura Donaldson":"10am-5pm"},26:{"Laura Donaldson":"10am-5pm"},27:{"Laura Donaldson":"10am-5pm"} } },
  { venue:"35", lat:51.877316870895, lng:-0.28020378140641, days:{ 5:{"Earth & Ember Pottery Collective":"10am-4pm"},11:{"Earth & Ember Pottery Collective":"10am-4pm"},12:{"Earth & Ember Pottery Collective":"10am-4pm"},18:{"Earth & Ember Pottery Collective":"10am-4pm"},19:{"Earth & Ember Pottery Collective":"10am-4pm"},25:{"Earth & Ember Pottery Collective":"10am-4pm"},26:{"Earth & Ember Pottery Collective":"10am-4pm"} } },
  { venue:"36", lat:51.881496800166, lng:-0.3053523427251, siteName:"Bendish Stables Artists", days:{ 5:{"Linda Anderson":"11am-4.30pm","Deirdre Shepherd":"11am-4.30pm"},6:{"Linda Anderson":"11am-4.30pm","Deirdre Shepherd":"11am-4.30pm"},9:{"Linda Anderson":"11am-4.30pm","Deirdre Shepherd":"11am-4.30pm"},12:{"Linda Anderson":"11am-4.30pm","Deirdre Shepherd":"11am-4.30pm"},13:{"Linda Anderson":"11am-4.30pm","Deirdre Shepherd":"11am-4.30pm"} } },
  { venue:"37", lat:52.011701989361, lng:-0.49820353206183, days:{ 9:{"Francesca Ricciardi":"10am-1pm"},11:{"Francesca Ricciardi":"10am-1pm"},12:{"Francesca Ricciardi":"10am-1pm"},16:{"Francesca Ricciardi":"10am-1pm"},18:{"Francesca Ricciardi":"10am-1pm"},19:{"Francesca Ricciardi":"10am-1pm"},22:{"Francesca Ricciardi":"10am-1pm"},23:{"Francesca Ricciardi":"10am-1pm"},25:{"Francesca Ricciardi":"10am-1pm"} } },
  { venue:"38", lat:51.9727, lng:-0.3307, siteName:"Stoneyards Studio", days:{ 5:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)","Debbie Armstrong (Fable Jewellery)":"1pm-5pm (present 5th, 6th, 12th, 13th only)"},6:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)","Debbie Armstrong (Fable Jewellery)":"1pm-5pm (present 5th, 6th, 12th, 13th only)"},7:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)"},8:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)"},9:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)"},10:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)"},11:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)"},12:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)","Debbie Armstrong (Fable Jewellery)":"1pm-5pm (present 5th, 6th, 12th, 13th only)"},13:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)","Debbie Armstrong (Fable Jewellery)":"1pm-5pm (present 5th, 6th, 12th, 13th only)"},14:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)"},15:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)"},16:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)"},17:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)"},18:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)"},19:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)"},20:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)"},21:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)"},22:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)"},23:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)"},24:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)"},25:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)"},26:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)"},27:{"Maggie Barton":"1pm-5pm (Private View Fri 4th Sept 6pm-9pm)"} } },
  { venue:"39", lat:51.9722737, lng:-0.3285437, siteName:"Royal Oak Studio", days:{ 12:{"Kate Buchanan":"1pm-5pm (Fri 18th 7pm-9pm)","Penelope Picken":"1pm-5pm (Fri 18th 7pm-9pm)"},13:{"Kate Buchanan":"1pm-5pm (Fri 18th 7pm-9pm)","Penelope Picken":"1pm-5pm (Fri 18th 7pm-9pm)"},18:{"Kate Buchanan":"1pm-5pm (Fri 18th 7pm-9pm)","Penelope Picken":"1pm-5pm (Fri 18th 7pm-9pm)"},20:{"Kate Buchanan":"1pm-5pm (Fri 18th 7pm-9pm)","Penelope Picken":"1pm-5pm (Fri 18th 7pm-9pm)"},25:{"Kate Buchanan":"1pm-5pm (Fri 18th 7pm-9pm)","Penelope Picken":"1pm-5pm (Fri 18th 7pm-9pm)"},26:{"Kate Buchanan":"1pm-5pm (Fri 18th 7pm-9pm)","Penelope Picken":"1pm-5pm (Fri 18th 7pm-9pm)"} } },
  { venue:"40", lat:51.929731026914, lng:-0.27427866986576, days:{ 5:{"Jo Charlton":"2pm-5pm (Sun 12noon-3pm)"},6:{"Jo Charlton":"2pm-5pm (Sun 12noon-3pm)"},10:{"Jo Charlton":"2pm-5pm (Sun 12noon-3pm)"},11:{"Jo Charlton":"2pm-5pm (Sun 12noon-3pm)"},12:{"Jo Charlton":"2pm-5pm (Sun 12noon-3pm)"},17:{"Jo Charlton":"2pm-5pm (Sun 12noon-3pm)"},18:{"Jo Charlton":"2pm-5pm (Sun 12noon-3pm)"},19:{"Jo Charlton":"2pm-5pm (Sun 12noon-3pm)"},20:{"Jo Charlton":"2pm-5pm (Sun 12noon-3pm)"} } },
  { venue:"41", lat:51.9545952, lng:-0.2866362, days:{ 12:{"Yoshie Allan":"1pm-5pm"},13:{"Yoshie Allan":"1pm-5pm"},19:{"Yoshie Allan":"1pm-5pm"},20:{"Yoshie Allan":"1pm-5pm"},26:{"Yoshie Allan":"1pm-5pm"},27:{"Yoshie Allan":"1pm-5pm"} } },
  { venue:"42", lat:51.9583035, lng:-0.2806851, siteName:"May and Mandy", days:{ 12:{"May Cheung Grant":"12noon-5.30pm","Mandy Lamyman":"12noon-5.30pm"},13:{"May Cheung Grant":"12noon-5.30pm","Mandy Lamyman":"12noon-5.30pm"},19:{"May Cheung Grant":"12noon-5.30pm","Mandy Lamyman":"12noon-5.30pm"},20:{"May Cheung Grant":"12noon-5.30pm","Mandy Lamyman":"12noon-5.30pm"},26:{"May Cheung Grant":"12noon-5.30pm","Mandy Lamyman":"12noon-5.30pm"},27:{"May Cheung Grant":"12noon-5.30pm","Mandy Lamyman":"12noon-5.30pm"} } },
  { venue:"43", lat:51.9540249, lng:-0.2776326, days:{ 19:{"Daniella Coronel Saavedra":"1pm-5pm"},20:{"Daniella Coronel Saavedra":"1pm-5pm"},26:{"Daniella Coronel Saavedra":"1pm-5pm"},27:{"Daniella Coronel Saavedra":"1pm-5pm"} } },
  { venue:"44", lat:51.9537253, lng:-0.2692224, days:{ 6:{"Beatrice Giacomini":"1pm-4pm"},12:{"Beatrice Giacomini":"1pm-4pm"},13:{"Beatrice Giacomini":"1pm-4pm"},20:{"Beatrice Giacomini":"1pm-4pm"},26:{"Beatrice Giacomini":"1pm-4pm"},27:{"Beatrice Giacomini":"1pm-4pm"} } },
  { venue:"45", lat:51.9434207, lng:-0.2530868, days:{ 6:{"Clay with Carole":"11am-4.30pm"},13:{"Clay with Carole":"11am-4.30pm"},20:{"Clay with Carole":"11am-4.30pm"},27:{"Clay with Carole":"11am-4.30pm"} } },
  { venue:"46", lat:51.9423952, lng:-0.2358058, days:{ 5:{"Becky Ullah":"10am-2pm (Sat/Sun 11am-4pm)"},6:{"Becky Ullah":"10am-2pm (Sat/Sun 11am-4pm)"},9:{"Becky Ullah":"10am-2pm (Sat/Sun 11am-4pm)"},11:{"Becky Ullah":"10am-2pm (Sat/Sun 11am-4pm)"},13:{"Becky Ullah":"10am-2pm (Sat/Sun 11am-4pm)"},16:{"Becky Ullah":"10am-2pm (Sat/Sun 11am-4pm)"},18:{"Becky Ullah":"10am-2pm (Sat/Sun 11am-4pm)"},19:{"Becky Ullah":"10am-2pm (Sat/Sun 11am-4pm)"},23:{"Becky Ullah":"10am-2pm (Sat/Sun 11am-4pm)"},25:{"Becky Ullah":"10am-2pm (Sat/Sun 11am-4pm)"},26:{"Becky Ullah":"10am-2pm (Sat/Sun 11am-4pm)"},27:{"Becky Ullah":"10am-2pm (Sat/Sun 11am-4pm)"} } },
  { venue:"47", lat:51.9822253, lng:-0.2250082, days:{ 5:{"Shannon Lane's Dreamworlds":"11am-4pm"},6:{"Shannon Lane's Dreamworlds":"11am-4pm"},7:{"Shannon Lane's Dreamworlds":"11am-4pm"},8:{"Shannon Lane's Dreamworlds":"11am-4pm"},9:{"Shannon Lane's Dreamworlds":"11am-4pm"},10:{"Shannon Lane's Dreamworlds":"11am-4pm"},11:{"Shannon Lane's Dreamworlds":"11am-4pm"},12:{"Shannon Lane's Dreamworlds":"11am-4pm"},13:{"Shannon Lane's Dreamworlds":"11am-4pm"},14:{"Shannon Lane's Dreamworlds":"11am-4pm"},15:{"Shannon Lane's Dreamworlds":"11am-4pm"},16:{"Shannon Lane's Dreamworlds":"11am-4pm"},17:{"Shannon Lane's Dreamworlds":"11am-4pm"},18:{"Shannon Lane's Dreamworlds":"11am-4pm"},19:{"Shannon Lane's Dreamworlds":"11am-4pm"},20:{"Shannon Lane's Dreamworlds":"11am-4pm"},21:{"Shannon Lane's Dreamworlds":"11am-4pm"},22:{"Shannon Lane's Dreamworlds":"11am-4pm"},23:{"Shannon Lane's Dreamworlds":"11am-4pm"},24:{"Shannon Lane's Dreamworlds":"11am-4pm"},25:{"Shannon Lane's Dreamworlds":"11am-4pm"},26:{"Shannon Lane's Dreamworlds":"11am-4pm"},27:{"Shannon Lane's Dreamworlds":"11am-4pm"} } },
  { venue:"48", lat:51.982223698461, lng:-0.22500472513122, siteName:"The Settlement Group", days:{ 5:{"Hazel Godfrey":"10am-4pm (Sat/Sun 12noon-4pm)","Trumble Creative":"10am-4pm (Sat/Sun 12noon-4pm)","Callum Abbott":"10am-4pm (Sat/Sun 12noon-4pm)","Elaine Kelly":"10am-4pm (Sat/Sun 12noon-4pm)"},6:{"Hazel Godfrey":"10am-4pm (Sat/Sun 12noon-4pm)","Trumble Creative":"10am-4pm (Sat/Sun 12noon-4pm)","Callum Abbott":"10am-4pm (Sat/Sun 12noon-4pm)","Elaine Kelly":"10am-4pm (Sat/Sun 12noon-4pm)"},10:{"Hazel Godfrey":"10am-4pm (Sat/Sun 12noon-4pm)","Trumble Creative":"10am-4pm (Sat/Sun 12noon-4pm)","Callum Abbott":"10am-4pm (Sat/Sun 12noon-4pm)","Elaine Kelly":"10am-4pm (Sat/Sun 12noon-4pm)"},11:{"Hazel Godfrey":"10am-4pm (Sat/Sun 12noon-4pm)","Trumble Creative":"10am-4pm (Sat/Sun 12noon-4pm)","Callum Abbott":"10am-4pm (Sat/Sun 12noon-4pm)","Elaine Kelly":"10am-4pm (Sat/Sun 12noon-4pm)"},12:{"Hazel Godfrey":"10am-4pm (Sat/Sun 12noon-4pm)","Trumble Creative":"10am-4pm (Sat/Sun 12noon-4pm)","Callum Abbott":"10am-4pm (Sat/Sun 12noon-4pm)","Elaine Kelly":"10am-4pm (Sat/Sun 12noon-4pm)"},13:{"Hazel Godfrey":"10am-4pm (Sat/Sun 12noon-4pm)","Trumble Creative":"10am-4pm (Sat/Sun 12noon-4pm)","Callum Abbott":"10am-4pm (Sat/Sun 12noon-4pm)","Elaine Kelly":"10am-4pm (Sat/Sun 12noon-4pm)"},17:{"Hazel Godfrey":"10am-4pm (Sat/Sun 12noon-4pm)","Trumble Creative":"10am-4pm (Sat/Sun 12noon-4pm)","Callum Abbott":"10am-4pm (Sat/Sun 12noon-4pm)","Elaine Kelly":"10am-4pm (Sat/Sun 12noon-4pm)"},18:{"Hazel Godfrey":"10am-4pm (Sat/Sun 12noon-4pm)","Trumble Creative":"10am-4pm (Sat/Sun 12noon-4pm)","Callum Abbott":"10am-4pm (Sat/Sun 12noon-4pm)","Elaine Kelly":"10am-4pm (Sat/Sun 12noon-4pm)"},19:{"Hazel Godfrey":"10am-4pm (Sat/Sun 12noon-4pm)","Trumble Creative":"10am-4pm (Sat/Sun 12noon-4pm)","Callum Abbott":"10am-4pm (Sat/Sun 12noon-4pm)","Elaine Kelly":"10am-4pm (Sat/Sun 12noon-4pm)"},20:{"Hazel Godfrey":"10am-4pm (Sat/Sun 12noon-4pm)","Trumble Creative":"10am-4pm (Sat/Sun 12noon-4pm)","Callum Abbott":"10am-4pm (Sat/Sun 12noon-4pm)","Elaine Kelly":"10am-4pm (Sat/Sun 12noon-4pm)"},24:{"Hazel Godfrey":"10am-4pm (Sat/Sun 12noon-4pm)","Trumble Creative":"10am-4pm (Sat/Sun 12noon-4pm)","Callum Abbott":"10am-4pm (Sat/Sun 12noon-4pm)","Elaine Kelly":"10am-4pm (Sat/Sun 12noon-4pm)"},25:{"Hazel Godfrey":"10am-4pm (Sat/Sun 12noon-4pm)","Trumble Creative":"10am-4pm (Sat/Sun 12noon-4pm)","Callum Abbott":"10am-4pm (Sat/Sun 12noon-4pm)","Elaine Kelly":"10am-4pm (Sat/Sun 12noon-4pm)"},26:{"Hazel Godfrey":"10am-4pm (Sat/Sun 12noon-4pm)","Trumble Creative":"10am-4pm (Sat/Sun 12noon-4pm)","Callum Abbott":"10am-4pm (Sat/Sun 12noon-4pm)","Elaine Kelly":"10am-4pm (Sat/Sun 12noon-4pm)"},27:{"Hazel Godfrey":"10am-4pm (Sat/Sun 12noon-4pm)","Trumble Creative":"10am-4pm (Sat/Sun 12noon-4pm)","Callum Abbott":"10am-4pm (Sat/Sun 12noon-4pm)","Elaine Kelly":"10am-4pm (Sat/Sun 12noon-4pm)"} } },
  { venue:"49", lat:52.0166022, lng:-0.2638379, days:{ 6:{"Jane Waterhouse":"11am-4pm"},7:{"Jane Waterhouse":"11am-4pm"},8:{"Jane Waterhouse":"11am-4pm"},9:{"Jane Waterhouse":"11am-4pm"},10:{"Jane Waterhouse":"11am-4pm"},11:{"Jane Waterhouse":"11am-4pm"},12:{"Jane Waterhouse":"11am-4pm"} } },
  { venue:"50", lat:51.9451475, lng:-0.1437507, days:{ 10:{"Liliane Textiles":"11am-6pm (Sat 11am-4pm)."},11:{"Liliane Textiles":"11am-6pm (Sat 11am-4pm)."},12:{"Liliane Textiles":"11am-6pm (Sat 11am-4pm)."},17:{"Liliane Textiles":"11am-6pm (Sat 11am-4pm)."},18:{"Liliane Textiles":"11am-6pm (Sat 11am-4pm)."},19:{"Liliane Textiles":"11am-6pm (Sat 11am-4pm)."},24:{"Liliane Textiles":"11am-6pm (Sat 11am-4pm)."},25:{"Liliane Textiles":"11am-6pm (Sat 11am-4pm)."},26:{"Liliane Textiles":"11am-6pm (Sat 11am-4pm)."} } },
  { venue:"51", lat:51.92806792482, lng:-0.098462223115106, days:{ 5:{"sonnie":"10am-3pm"},6:{"sonnie":"10am-3pm"},13:{"sonnie":"10am-3pm"},20:{"sonnie":"10am-3pm"},26:{"sonnie":"10am-3pm"},27:{"sonnie":"10am-3pm"} } },
  { venue:"52", lat:51.9884, lng:-0.1875, siteName:"Shaped by Nature", days:{ 5:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm","Deb Manning-Webb":"11am-3pm (Fri/Sat only)"},6:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm"},7:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm"},8:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm"},9:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm"},10:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm"},11:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm","Deb Manning-Webb":"11am-3pm (Fri/Sat only)"},12:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm","Deb Manning-Webb":"11am-3pm (Fri/Sat only)"},13:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm"},14:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm"},15:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm"},16:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm"},17:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm"},18:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm","Deb Manning-Webb":"11am-3pm (Fri/Sat only)"},19:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm","Deb Manning-Webb":"11am-3pm (Fri/Sat only)"},20:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm"},21:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm"},22:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm"},23:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm"},24:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm"},25:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm","Deb Manning-Webb":"11am-3pm (Fri/Sat only)"},26:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm","Deb Manning-Webb":"11am-3pm (Fri/Sat only)"},27:{"Bea Brown":"11am-3pm","Gillian Weddle Fine Art":"11am-3pm","Val Lawson":"11am-3pm"} } },
  { venue:"53", lat:51.9575478523, lng:0.026013420043207, days:{ 5:{"Jan Elliott":"10am-5pm (Sun 2pm-5pm)"},6:{"Jan Elliott":"10am-5pm (Sun 2pm-5pm)"},12:{"Jan Elliott":"10am-5pm (Sun 2pm-5pm)"},13:{"Jan Elliott":"10am-5pm (Sun 2pm-5pm)"},19:{"Jan Elliott":"10am-5pm (Sun 2pm-5pm)"},20:{"Jan Elliott":"10am-5pm (Sun 2pm-5pm)"},26:{"Jan Elliott":"10am-5pm (Sun 2pm-5pm)"},27:{"Jan Elliott":"10am-5pm (Sun 2pm-5pm)"} } },
  { venue:"54", lat:51.874236156443, lng:0.15910101649529, days:{ 5:{"Townhouse Ceramics Studio & Gallery":"11am-4pm"},6:{"Townhouse Ceramics Studio & Gallery":"11am-4pm"},10:{"Townhouse Ceramics Studio & Gallery":"11am-4pm"},11:{"Townhouse Ceramics Studio & Gallery":"11am-4pm"},12:{"Townhouse Ceramics Studio & Gallery":"11am-4pm"},13:{"Townhouse Ceramics Studio & Gallery":"11am-4pm"},17:{"Townhouse Ceramics Studio & Gallery":"11am-4pm"},18:{"Townhouse Ceramics Studio & Gallery":"11am-4pm"},19:{"Townhouse Ceramics Studio & Gallery":"11am-4pm"},20:{"Townhouse Ceramics Studio & Gallery":"11am-4pm"},24:{"Townhouse Ceramics Studio & Gallery":"11am-4pm"},25:{"Townhouse Ceramics Studio & Gallery":"11am-4pm"},26:{"Townhouse Ceramics Studio & Gallery":"11am-4pm"},27:{"Townhouse Ceramics Studio & Gallery":"11am-4pm"} } },
  { venue:"55", lat:51.863534, lng:0.163968, days:{ 5:{"Chloe Deltufo":"10am-5pm (Sat 10am-4pm)"},7:{"Chloe Deltufo":"10am-5pm (Sat 10am-4pm)"},8:{"Chloe Deltufo":"10am-5pm (Sat 10am-4pm)"},9:{"Chloe Deltufo":"10am-5pm (Sat 10am-4pm)"},10:{"Chloe Deltufo":"10am-5pm (Sat 10am-4pm)"},11:{"Chloe Deltufo":"10am-5pm (Sat 10am-4pm)"},12:{"Chloe Deltufo":"10am-5pm (Sat 10am-4pm)"},14:{"Chloe Deltufo":"10am-5pm (Sat 10am-4pm)"},15:{"Chloe Deltufo":"10am-5pm (Sat 10am-4pm)"},16:{"Chloe Deltufo":"10am-5pm (Sat 10am-4pm)"},17:{"Chloe Deltufo":"10am-5pm (Sat 10am-4pm)"},18:{"Chloe Deltufo":"10am-5pm (Sat 10am-4pm)"},19:{"Chloe Deltufo":"10am-5pm (Sat 10am-4pm)"},21:{"Chloe Deltufo":"10am-5pm (Sat 10am-4pm)"},22:{"Chloe Deltufo":"10am-5pm (Sat 10am-4pm)"},23:{"Chloe Deltufo":"10am-5pm (Sat 10am-4pm)"},24:{"Chloe Deltufo":"10am-5pm (Sat 10am-4pm)"},25:{"Chloe Deltufo":"10am-5pm (Sat 10am-4pm)"},26:{"Chloe Deltufo":"10am-5pm (Sat 10am-4pm)"} } },
  { venue:"56", lat:51.7902691, lng:0.0089035, days:{ 17:{"Linda Gifford":"11am-5pm (Thur 1pm-5pm)"},19:{"Linda Gifford":"11am-5pm (Thur 1pm-5pm)"},20:{"Linda Gifford":"11am-5pm (Thur 1pm-5pm)"},24:{"Linda Gifford":"11am-5pm (Thur 1pm-5pm)"},26:{"Linda Gifford":"11am-5pm (Thur 1pm-5pm)"},27:{"Linda Gifford":"11am-5pm (Thur 1pm-5pm)"} } },
  { venue:"57", lat:51.762506, lng:-0.011945, siteName:"The Hoddesdon Collective", days:{ 5:{"Chris House":"10.30am-3pm","Dave Wye":"10.30am-3pm"},10:{"Chris House":"10.30am-3pm","Dave Wye":"10.30am-3pm"},11:{"Chris House":"10.30am-3pm","Dave Wye":"10.30am-3pm"},12:{"Chris House":"10.30am-3pm","Dave Wye":"10.30am-3pm"},17:{"Chris House":"10.30am-3pm","Dave Wye":"10.30am-3pm"},18:{"Chris House":"10.30am-3pm","Dave Wye":"10.30am-3pm"},19:{"Chris House":"10.30am-3pm","Dave Wye":"10.30am-3pm"},24:{"Chris House":"10.30am-3pm","Dave Wye":"10.30am-3pm"},25:{"Chris House":"10.30am-3pm","Dave Wye":"10.30am-3pm"},26:{"Chris House":"10.30am-3pm","Dave Wye":"10.30am-3pm"} } },
  { venue:"58", lat:51.810749, lng:-0.027843, siteName:"Ware Group", days:{ 5:{"Teresa West":"1pm-5pm (Sun 10am-4pm)","Rekha Gopinath":"1pm-5pm (Sun 10am-4pm)","Julia Fonnereau":"1pm-5pm (Sun 10am-4pm)","Marian Sheraidah":"1pm-5pm (Sun 10am-4pm)","Sarah Bissett Scott":"1pm-5pm (Sun 10am-4pm)","warethewomanwent":"1pm-5pm (Sun 10am-4pm)"},6:{"Teresa West":"1pm-5pm (Sun 10am-4pm)","Rekha Gopinath":"1pm-5pm (Sun 10am-4pm)","Julia Fonnereau":"1pm-5pm (Sun 10am-4pm)","Marian Sheraidah":"1pm-5pm (Sun 10am-4pm)","Sarah Bissett Scott":"1pm-5pm (Sun 10am-4pm)","warethewomanwent":"1pm-5pm (Sun 10am-4pm)"},10:{"Teresa West":"1pm-5pm (Sun 10am-4pm)","Rekha Gopinath":"1pm-5pm (Sun 10am-4pm)","Julia Fonnereau":"1pm-5pm (Sun 10am-4pm)","Marian Sheraidah":"1pm-5pm (Sun 10am-4pm)","Sarah Bissett Scott":"1pm-5pm (Sun 10am-4pm)","warethewomanwent":"1pm-5pm (Sun 10am-4pm)"},11:{"Teresa West":"1pm-5pm (Sun 10am-4pm)","Rekha Gopinath":"1pm-5pm (Sun 10am-4pm)","Julia Fonnereau":"1pm-5pm (Sun 10am-4pm)","Marian Sheraidah":"1pm-5pm (Sun 10am-4pm)","Sarah Bissett Scott":"1pm-5pm (Sun 10am-4pm)","warethewomanwent":"1pm-5pm (Sun 10am-4pm)"},12:{"Teresa West":"1pm-5pm (Sun 10am-4pm)","Rekha Gopinath":"1pm-5pm (Sun 10am-4pm)","Julia Fonnereau":"1pm-5pm (Sun 10am-4pm)","Marian Sheraidah":"1pm-5pm (Sun 10am-4pm)","Sarah Bissett Scott":"1pm-5pm (Sun 10am-4pm)","warethewomanwent":"1pm-5pm (Sun 10am-4pm)"},17:{"Teresa West":"1pm-5pm (Sun 10am-4pm)","Rekha Gopinath":"1pm-5pm (Sun 10am-4pm)","Julia Fonnereau":"1pm-5pm (Sun 10am-4pm)","Marian Sheraidah":"1pm-5pm (Sun 10am-4pm)","Sarah Bissett Scott":"1pm-5pm (Sun 10am-4pm)","warethewomanwent":"1pm-5pm (Sun 10am-4pm)"},18:{"Teresa West":"1pm-5pm (Sun 10am-4pm)","Rekha Gopinath":"1pm-5pm (Sun 10am-4pm)","Julia Fonnereau":"1pm-5pm (Sun 10am-4pm)","Marian Sheraidah":"1pm-5pm (Sun 10am-4pm)","Sarah Bissett Scott":"1pm-5pm (Sun 10am-4pm)","warethewomanwent":"1pm-5pm (Sun 10am-4pm)"},19:{"Teresa West":"1pm-5pm (Sun 10am-4pm)","Rekha Gopinath":"1pm-5pm (Sun 10am-4pm)","Julia Fonnereau":"1pm-5pm (Sun 10am-4pm)","Marian Sheraidah":"1pm-5pm (Sun 10am-4pm)","Sarah Bissett Scott":"1pm-5pm (Sun 10am-4pm)","warethewomanwent":"1pm-5pm (Sun 10am-4pm)"},20:{"Teresa West":"1pm-5pm (Sun 10am-4pm)","Rekha Gopinath":"1pm-5pm (Sun 10am-4pm)","Julia Fonnereau":"1pm-5pm (Sun 10am-4pm)","Marian Sheraidah":"1pm-5pm (Sun 10am-4pm)","Sarah Bissett Scott":"1pm-5pm (Sun 10am-4pm)","warethewomanwent":"1pm-5pm (Sun 10am-4pm)"},24:{"Teresa West":"1pm-5pm (Sun 10am-4pm)","Rekha Gopinath":"1pm-5pm (Sun 10am-4pm)","Julia Fonnereau":"1pm-5pm (Sun 10am-4pm)","Marian Sheraidah":"1pm-5pm (Sun 10am-4pm)","Sarah Bissett Scott":"1pm-5pm (Sun 10am-4pm)","warethewomanwent":"1pm-5pm (Sun 10am-4pm)"},25:{"Teresa West":"1pm-5pm (Sun 10am-4pm)","Rekha Gopinath":"1pm-5pm (Sun 10am-4pm)","Julia Fonnereau":"1pm-5pm (Sun 10am-4pm)","Marian Sheraidah":"1pm-5pm (Sun 10am-4pm)","Sarah Bissett Scott":"1pm-5pm (Sun 10am-4pm)","warethewomanwent":"1pm-5pm (Sun 10am-4pm)"},26:{"Teresa West":"1pm-5pm (Sun 10am-4pm)","Rekha Gopinath":"1pm-5pm (Sun 10am-4pm)","Julia Fonnereau":"1pm-5pm (Sun 10am-4pm)","Marian Sheraidah":"1pm-5pm (Sun 10am-4pm)","Sarah Bissett Scott":"1pm-5pm (Sun 10am-4pm)","warethewomanwent":"1pm-5pm (Sun 10am-4pm)"},27:{"Teresa West":"1pm-5pm (Sun 10am-4pm)","Rekha Gopinath":"1pm-5pm (Sun 10am-4pm)","Julia Fonnereau":"1pm-5pm (Sun 10am-4pm)","Marian Sheraidah":"1pm-5pm (Sun 10am-4pm)","Sarah Bissett Scott":"1pm-5pm (Sun 10am-4pm)","warethewomanwent":"1pm-5pm (Sun 10am-4pm)"} } },
  { venue:"59", lat:51.811924, lng:-0.034448, days:{ 12:{"The Maker & Mind Studio":"10am-3pm (Thu/Sat 10-5pm)"},15:{"The Maker & Mind Studio":"10am-3pm (Thu/Sat 10-5pm)"},16:{"The Maker & Mind Studio":"10am-3pm (Thu/Sat 10-5pm)"},17:{"The Maker & Mind Studio":"10am-3pm (Thu/Sat 10-5pm)"},18:{"The Maker & Mind Studio":"10am-3pm (Thu/Sat 10-5pm)"},19:{"The Maker & Mind Studio":"10am-3pm (Thu/Sat 10-5pm)"},22:{"The Maker & Mind Studio":"10am-3pm (Thu/Sat 10-5pm)"},23:{"The Maker & Mind Studio":"10am-3pm (Thu/Sat 10-5pm)"},24:{"The Maker & Mind Studio":"10am-3pm (Thu/Sat 10-5pm)"},25:{"The Maker & Mind Studio":"10am-3pm (Thu/Sat 10-5pm)"},26:{"The Maker & Mind Studio":"10am-3pm (Thu/Sat 10-5pm)"} } },
  { venue:"60", lat:51.80116253438, lng:-0.05555513968672, siteName:"Ware Road Collective", days:{ 5:{"Jane Carr":"12noon-5pm","Ahlam Conti":"12noon-5pm"},6:{"Jane Carr":"12noon-5pm","Ahlam Conti":"12noon-5pm"},12:{"Jane Carr":"12noon-5pm","Ahlam Conti":"12noon-5pm"},13:{"Jane Carr":"12noon-5pm","Ahlam Conti":"12noon-5pm"},19:{"Jane Carr":"12noon-5pm","Ahlam Conti":"12noon-5pm"},20:{"Jane Carr":"12noon-5pm","Ahlam Conti":"12noon-5pm"},26:{"Jane Carr":"12noon-5pm","Ahlam Conti":"12noon-5pm"},27:{"Jane Carr":"12noon-5pm","Ahlam Conti":"12noon-5pm"} } },
  { venue:"61", lat:51.7960355, lng:-0.0772875, siteName:"Mudlark Cafe", profileUrl:"https://www.hvaf.org.uk/open-studios-search/?_site_number=61", days:{ 5:{"Elif Lewis":"9am-4pm"},8:{"Elif Lewis":"9am-4pm"},9:{"Elif Lewis":"9am-4pm"},10:{"Elif Lewis":"9am-4pm"},11:{"Elif Lewis":"9am-4pm"},12:{"Elif Lewis":"9am-4pm"},15:{"Elif Lewis":"9am-4pm"},16:{"Elif Lewis":"9am-4pm"},17:{"Elif Lewis":"9am-4pm"},18:{"Elif Lewis":"9am-4pm"},19:{"Elif Lewis":"9am-4pm"},22:{"Elif Lewis":"9am-4pm"},23:{"Elif Lewis":"9am-4pm"},24:{"Elif Lewis":"9am-4pm"},25:{"Elif Lewis":"9am-4pm"},26:{"Elif Lewis":"9am-4pm"} } },
  { venue:"62", lat:51.7591606, lng:-0.0770965, siteName:"Prehistoric Futures", profileUrl:"https://www.hvaf.org.uk/open-studios-search/?_site_number=62", days:{ 12:{"Elif Lewis":"10am-5pm","Sally Taylor":"10am-5pm"},13:{"Elif Lewis":"10am-5pm","Sally Taylor":"10am-5pm"},19:{"Elif Lewis":"10am-5pm","Sally Taylor":"10am-5pm"},20:{"Elif Lewis":"10am-5pm","Sally Taylor":"10am-5pm"},26:{"Elif Lewis":"10am-5pm","Sally Taylor":"10am-5pm"},27:{"Elif Lewis":"10am-5pm","Sally Taylor":"10am-5pm"} } },
  { venue:"63", lat:51.85122, lng:-0.1727802, siteName:"ART@MG-Mardleybury Gallery", days:{ 10:{"Marilyn Comparetto":"11am-4pm","Mardleybury Gallery Group":"11am-4pm","Fiona Fraser":"11am-4pm"},11:{"Marilyn Comparetto":"11am-4pm","Mardleybury Gallery Group":"11am-4pm","Fiona Fraser":"11am-4pm"},12:{"Marilyn Comparetto":"11am-4pm","Mardleybury Gallery Group":"11am-4pm","Fiona Fraser":"11am-4pm"},13:{"Marilyn Comparetto":"11am-4pm","Mardleybury Gallery Group":"11am-4pm","Fiona Fraser":"11am-4pm"},17:{"Marilyn Comparetto":"11am-4pm","Mardleybury Gallery Group":"11am-4pm","Fiona Fraser":"11am-4pm"},18:{"Marilyn Comparetto":"11am-4pm","Mardleybury Gallery Group":"11am-4pm","Fiona Fraser":"11am-4pm"},19:{"Marilyn Comparetto":"11am-4pm","Mardleybury Gallery Group":"11am-4pm","Fiona Fraser":"11am-4pm"},20:{"Marilyn Comparetto":"11am-4pm","Mardleybury Gallery Group":"11am-4pm","Fiona Fraser":"11am-4pm"},24:{"Marilyn Comparetto":"11am-4pm","Mardleybury Gallery Group":"11am-4pm","Fiona Fraser":"11am-4pm"},25:{"Marilyn Comparetto":"11am-4pm","Mardleybury Gallery Group":"11am-4pm","Fiona Fraser":"11am-4pm"},26:{"Marilyn Comparetto":"11am-4pm","Mardleybury Gallery Group":"11am-4pm","Fiona Fraser":"11am-4pm"},27:{"Marilyn Comparetto":"11am-4pm","Mardleybury Gallery Group":"11am-4pm","Fiona Fraser":"11am-4pm"} } },
  { venue:"64", lat:51.816961, lng:-0.188018, days:{ 6:{"Digswell Arts Artists":"11am-5pm"},12:{"Digswell Arts Artists":"11am-5pm"} } },
  { venue:"65", lat:51.801304657277, lng:-0.20550908439073, siteName:"Artists at the Howard Centre", days:{ 19:{"Heather Miller":"10am-5pm (Sun 11am-4pm)","Paul Hillary":"10am-5pm (Sun 11am-4pm)","Tina Hart":"10am-5pm (Sun 11am-4pm)","Judy Century":"10am-5pm (Sun 11am-4pm)","Zoe Beaumont":"10am-5pm (Sun 11am-4pm)","Holly Casey":"10am-5pm (Sun 11am-4pm)","Yves Sancier":"10am-5pm (Sun 11am-4pm)","Faiza Hassan":"10am-5pm (Sun 11am-4pm)","Gill Davies":"10am-5pm (Sun 11am-4pm)","Wendy Creak":"10am-5pm (Sun 11am-4pm)","Angela Bull":"10am-5pm (Sun 11am-4pm)"},20:{"Heather Miller":"10am-5pm (Sun 11am-4pm)","Paul Hillary":"10am-5pm (Sun 11am-4pm)","Tina Hart":"10am-5pm (Sun 11am-4pm)","Judy Century":"10am-5pm (Sun 11am-4pm)","Zoe Beaumont":"10am-5pm (Sun 11am-4pm)","Holly Casey":"10am-5pm (Sun 11am-4pm)","Yves Sancier":"10am-5pm (Sun 11am-4pm)","Faiza Hassan":"10am-5pm (Sun 11am-4pm)","Gill Davies":"10am-5pm (Sun 11am-4pm)","Wendy Creak":"10am-5pm (Sun 11am-4pm)","Angela Bull":"10am-5pm (Sun 11am-4pm)"},23:{"Heather Miller":"10am-5pm (Sun 11am-4pm)","Paul Hillary":"10am-5pm (Sun 11am-4pm)","Tina Hart":"10am-5pm (Sun 11am-4pm)","Judy Century":"10am-5pm (Sun 11am-4pm)","Zoe Beaumont":"10am-5pm (Sun 11am-4pm)","Holly Casey":"10am-5pm (Sun 11am-4pm)","Yves Sancier":"10am-5pm (Sun 11am-4pm)","Faiza Hassan":"10am-5pm (Sun 11am-4pm)","Gill Davies":"10am-5pm (Sun 11am-4pm)","Wendy Creak":"10am-5pm (Sun 11am-4pm)","Angela Bull":"10am-5pm (Sun 11am-4pm)"},24:{"Heather Miller":"10am-5pm (Sun 11am-4pm)","Paul Hillary":"10am-5pm (Sun 11am-4pm)","Tina Hart":"10am-5pm (Sun 11am-4pm)","Judy Century":"10am-5pm (Sun 11am-4pm)","Zoe Beaumont":"10am-5pm (Sun 11am-4pm)","Holly Casey":"10am-5pm (Sun 11am-4pm)","Yves Sancier":"10am-5pm (Sun 11am-4pm)","Faiza Hassan":"10am-5pm (Sun 11am-4pm)","Gill Davies":"10am-5pm (Sun 11am-4pm)","Wendy Creak":"10am-5pm (Sun 11am-4pm)","Angela Bull":"10am-5pm (Sun 11am-4pm)"},25:{"Heather Miller":"10am-5pm (Sun 11am-4pm)","Paul Hillary":"10am-5pm (Sun 11am-4pm)","Tina Hart":"10am-5pm (Sun 11am-4pm)","Judy Century":"10am-5pm (Sun 11am-4pm)","Zoe Beaumont":"10am-5pm (Sun 11am-4pm)","Holly Casey":"10am-5pm (Sun 11am-4pm)","Yves Sancier":"10am-5pm (Sun 11am-4pm)","Faiza Hassan":"10am-5pm (Sun 11am-4pm)","Gill Davies":"10am-5pm (Sun 11am-4pm)","Wendy Creak":"10am-5pm (Sun 11am-4pm)","Angela Bull":"10am-5pm (Sun 11am-4pm)"},26:{"Heather Miller":"10am-5pm (Sun 11am-4pm)","Paul Hillary":"10am-5pm (Sun 11am-4pm)","Tina Hart":"10am-5pm (Sun 11am-4pm)","Judy Century":"10am-5pm (Sun 11am-4pm)","Zoe Beaumont":"10am-5pm (Sun 11am-4pm)","Holly Casey":"10am-5pm (Sun 11am-4pm)","Yves Sancier":"10am-5pm (Sun 11am-4pm)","Faiza Hassan":"10am-5pm (Sun 11am-4pm)","Gill Davies":"10am-5pm (Sun 11am-4pm)","Wendy Creak":"10am-5pm (Sun 11am-4pm)","Angela Bull":"10am-5pm (Sun 11am-4pm)"},27:{"Heather Miller":"10am-5pm (Sun 11am-4pm)","Paul Hillary":"10am-5pm (Sun 11am-4pm)","Tina Hart":"10am-5pm (Sun 11am-4pm)","Judy Century":"10am-5pm (Sun 11am-4pm)","Zoe Beaumont":"10am-5pm (Sun 11am-4pm)","Holly Casey":"10am-5pm (Sun 11am-4pm)","Yves Sancier":"10am-5pm (Sun 11am-4pm)","Faiza Hassan":"10am-5pm (Sun 11am-4pm)","Gill Davies":"10am-5pm (Sun 11am-4pm)","Wendy Creak":"10am-5pm (Sun 11am-4pm)","Angela Bull":"10am-5pm (Sun 11am-4pm)"} } },
  { venue:"66", lat:51.7632707, lng:-0.2376494, days:{ 5:{"H'arts in Mind Gallery":"11am-5pm (Sun 12noon-4pm)"},6:{"H'arts in Mind Gallery":"11am-5pm (Sun 12noon-4pm)"},10:{"H'arts in Mind Gallery":"11am-5pm (Sun 12noon-4pm)"},11:{"H'arts in Mind Gallery":"11am-5pm (Sun 12noon-4pm)"},12:{"H'arts in Mind Gallery":"11am-5pm (Sun 12noon-4pm)"},13:{"H'arts in Mind Gallery":"11am-5pm (Sun 12noon-4pm)"},17:{"H'arts in Mind Gallery":"11am-5pm (Sun 12noon-4pm)"},18:{"H'arts in Mind Gallery":"11am-5pm (Sun 12noon-4pm)"},19:{"H'arts in Mind Gallery":"11am-5pm (Sun 12noon-4pm)"},20:{"H'arts in Mind Gallery":"11am-5pm (Sun 12noon-4pm)"},24:{"H'arts in Mind Gallery":"11am-5pm (Sun 12noon-4pm)"},25:{"H'arts in Mind Gallery":"11am-5pm (Sun 12noon-4pm)"} } },
  { venue:"67", lat:51.7059508, lng:-0.2042391, days:{ 9:{"Jo Cooper Jewellery":"11am-4pm"},10:{"Jo Cooper Jewellery":"11am-4pm"},23:{"Jo Cooper Jewellery":"11am-4pm"},24:{"Jo Cooper Jewellery":"11am-4pm"} } },
  { venue:"68", lat:51.6948566, lng:-0.200039, days:{ 6:{"Bernard Gorry":"11am-3pm"},12:{"Bernard Gorry":"11am-3pm"},13:{"Bernard Gorry":"11am-3pm"},19:{"Bernard Gorry":"11am-3pm"},20:{"Bernard Gorry":"11am-3pm"} } },
  { venue:"69", lat:51.654462630791, lng:-0.16511407994571, days:{ 5:{"Rowena Berliner":"11am-4pm"},6:{"Rowena Berliner":"11am-4pm"},11:{"Rowena Berliner":"11am-4pm"},12:{"Rowena Berliner":"11am-4pm"},13:{"Rowena Berliner":"11am-4pm"} } },
  { venue:"70", lat:51.6110559, lng:-0.2380041, days:{ 6:{"Victoria Perloff":"1pm-3pm (Sun 3pm-8pm)"},10:{"Victoria Perloff":"1pm-3pm (Sun 3pm-8pm)"},17:{"Victoria Perloff":"1pm-3pm (Sun 3pm-8pm)"},23:{"Victoria Perloff":"1pm-3pm (Sun 3pm-8pm)"},24:{"Victoria Perloff":"1pm-3pm (Sun 3pm-8pm)"},26:{"Victoria Perloff":"1pm-3pm (Sun 3pm-8pm)"} } },
  { venue:"71", lat:51.651197073391, lng:-0.30803046826171, days:{ 6:{"Sarah Core Arts":"11am-3.30pm (Mon 2pm-6pm)"},7:{"Sarah Core Arts":"11am-3.30pm (Mon 2pm-6pm)"},11:{"Sarah Core Arts":"11am-3.30pm (Mon 2pm-6pm)"},13:{"Sarah Core Arts":"11am-3.30pm (Mon 2pm-6pm)"},14:{"Sarah Core Arts":"11am-3.30pm (Mon 2pm-6pm)"},18:{"Sarah Core Arts":"11am-3.30pm (Mon 2pm-6pm)"},20:{"Sarah Core Arts":"11am-3.30pm (Mon 2pm-6pm)"},21:{"Sarah Core Arts":"11am-3.30pm (Mon 2pm-6pm)"},25:{"Sarah Core Arts":"11am-3.30pm (Mon 2pm-6pm)"},27:{"Sarah Core Arts":"11am-3.30pm (Mon 2pm-6pm)"} } },
  { venue:"72", lat:51.6723139, lng:-0.3856377, days:{ 6:{"Hetal Asher Babla":"11am-2pm (Sun 1pm-5pm)"},7:{"Hetal Asher Babla":"11am-2pm (Sun 1pm-5pm)"},8:{"Hetal Asher Babla":"11am-2pm (Sun 1pm-5pm)"},9:{"Hetal Asher Babla":"11am-2pm (Sun 1pm-5pm)"},10:{"Hetal Asher Babla":"11am-2pm (Sun 1pm-5pm)"},13:{"Hetal Asher Babla":"11am-2pm (Sun 1pm-5pm)"},20:{"Hetal Asher Babla":"11am-2pm (Sun 1pm-5pm)"},27:{"Hetal Asher Babla":"11am-2pm (Sun 1pm-5pm)"} } },
  { venue:"73", lat:51.6553811, lng:-0.3818892, days:{ 8:{"Geoffrey Howe":"12noon-2pm (Sun 11am-3pm)"},9:{"Geoffrey Howe":"12noon-2pm (Sun 11am-3pm)"},20:{"Geoffrey Howe":"12noon-2pm (Sun 11am-3pm)"},21:{"Geoffrey Howe":"12noon-2pm (Sun 11am-3pm)"},22:{"Geoffrey Howe":"12noon-2pm (Sun 11am-3pm)"} } },
  { venue:"74", lat:51.6501055, lng:-0.3888533, days:{ 5:{"Mark Davies":"1pm-5pm (Tue 2pm-9pm, Sat 2pm-6pm)"},7:{"Mark Davies":"1pm-5pm (Tue 2pm-9pm, Sat 2pm-6pm)"},8:{"Mark Davies":"1pm-5pm (Tue 2pm-9pm, Sat 2pm-6pm)"},9:{"Mark Davies":"1pm-5pm (Tue 2pm-9pm, Sat 2pm-6pm)"},10:{"Mark Davies":"1pm-5pm (Tue 2pm-9pm, Sat 2pm-6pm)"},11:{"Mark Davies":"1pm-5pm (Tue 2pm-9pm, Sat 2pm-6pm)"},12:{"Mark Davies":"1pm-5pm (Tue 2pm-9pm, Sat 2pm-6pm)"},14:{"Mark Davies":"1pm-5pm (Tue 2pm-9pm, Sat 2pm-6pm)"},15:{"Mark Davies":"1pm-5pm (Tue 2pm-9pm, Sat 2pm-6pm)"},16:{"Mark Davies":"1pm-5pm (Tue 2pm-9pm, Sat 2pm-6pm)"},17:{"Mark Davies":"1pm-5pm (Tue 2pm-9pm, Sat 2pm-6pm)"},18:{"Mark Davies":"1pm-5pm (Tue 2pm-9pm, Sat 2pm-6pm)"},19:{"Mark Davies":"1pm-5pm (Tue 2pm-9pm, Sat 2pm-6pm)"},21:{"Mark Davies":"1pm-5pm (Tue 2pm-9pm, Sat 2pm-6pm)"},22:{"Mark Davies":"1pm-5pm (Tue 2pm-9pm, Sat 2pm-6pm)"},23:{"Mark Davies":"1pm-5pm (Tue 2pm-9pm, Sat 2pm-6pm)"},24:{"Mark Davies":"1pm-5pm (Tue 2pm-9pm, Sat 2pm-6pm)"},25:{"Mark Davies":"1pm-5pm (Tue 2pm-9pm, Sat 2pm-6pm)"},26:{"Mark Davies":"1pm-5pm (Tue 2pm-9pm, Sat 2pm-6pm)"} } },
  { venue:"75", lat:51.663635709702, lng:-0.40017701805789, days:{ 5:{"Picture Maker Gallery":"9am-5pm"},8:{"Picture Maker Gallery":"9am-5pm"},9:{"Picture Maker Gallery":"9am-5pm"},10:{"Picture Maker Gallery":"9am-5pm"},11:{"Picture Maker Gallery":"9am-5pm"},12:{"Picture Maker Gallery":"9am-5pm"},15:{"Picture Maker Gallery":"9am-5pm"},16:{"Picture Maker Gallery":"9am-5pm"},17:{"Picture Maker Gallery":"9am-5pm"},18:{"Picture Maker Gallery":"9am-5pm"},19:{"Picture Maker Gallery":"9am-5pm"},22:{"Picture Maker Gallery":"9am-5pm"},23:{"Picture Maker Gallery":"9am-5pm"},24:{"Picture Maker Gallery":"9am-5pm"},25:{"Picture Maker Gallery":"9am-5pm"},26:{"Picture Maker Gallery":"9am-5pm"} } },
  { venue:"76", lat:51.652472, lng:-0.4485072, days:{ 19:{"Mishi Rehal":"12noon-4.30pm (Fri 5.30pm-8pm)"},25:{"Mishi Rehal":"12noon-4.30pm (Fri 5.30pm-8pm)"},26:{"Mishi Rehal":"12noon-4.30pm (Fri 5.30pm-8pm)"} } },
  { venue:"77", lat:51.6341437, lng:-0.4670576, siteName:"Art @ The White Bear", days:{ 10:{"Linda Noone":"3.30pm-6.30pm (Sat/Sun 12.30pm-3.30pm)","Lawrence Noone":"3.30pm-6.30pm (Sat/Sun 12.30pm-3.30pm)"},11:{"Linda Noone":"3.30pm-6.30pm (Sat/Sun 12.30pm-3.30pm)","Lawrence Noone":"3.30pm-6.30pm (Sat/Sun 12.30pm-3.30pm)"},12:{"Linda Noone":"3.30pm-6.30pm (Sat/Sun 12.30pm-3.30pm)","Lawrence Noone":"3.30pm-6.30pm (Sat/Sun 12.30pm-3.30pm)"},13:{"Linda Noone":"3.30pm-6.30pm (Sat/Sun 12.30pm-3.30pm)","Lawrence Noone":"3.30pm-6.30pm (Sat/Sun 12.30pm-3.30pm)"},16:{"Linda Noone":"3.30pm-6.30pm (Sat/Sun 12.30pm-3.30pm)","Lawrence Noone":"3.30pm-6.30pm (Sat/Sun 12.30pm-3.30pm)"},17:{"Linda Noone":"3.30pm-6.30pm (Sat/Sun 12.30pm-3.30pm)","Lawrence Noone":"3.30pm-6.30pm (Sat/Sun 12.30pm-3.30pm)"},18:{"Linda Noone":"3.30pm-6.30pm (Sat/Sun 12.30pm-3.30pm)","Lawrence Noone":"3.30pm-6.30pm (Sat/Sun 12.30pm-3.30pm)"} } },
  { venue:"78", lat:51.7065324, lng:-0.4251445, days:{ 5:{"Victor Child":"1pm-5pm"},6:{"Victor Child":"1pm-5pm"},9:{"Victor Child":"1pm-5pm"},12:{"Victor Child":"1pm-5pm"},15:{"Victor Child":"1pm-5pm"},16:{"Victor Child":"1pm-5pm"},19:{"Victor Child":"1pm-5pm"},22:{"Victor Child":"1pm-5pm"},23:{"Victor Child":"1pm-5pm"},26:{"Victor Child":"1pm-5pm"},27:{"Victor Child":"1pm-5pm"} } },
  { venue:"79", lat:51.708224850422, lng:-0.42046222989405, days:{ 6:{"Jenny Young":"10am-4pm (Mon 2pm-5pm & 6.30pm-8pm; Wed 10am-5pm)"},7:{"Jenny Young":"10am-4pm (Mon 2pm-5pm & 6.30pm-8pm; Wed 10am-5pm)"},9:{"Jenny Young":"10am-4pm (Mon 2pm-5pm & 6.30pm-8pm; Wed 10am-5pm)"},13:{"Jenny Young":"10am-4pm (Mon 2pm-5pm & 6.30pm-8pm; Wed 10am-5pm)"},14:{"Jenny Young":"10am-4pm (Mon 2pm-5pm & 6.30pm-8pm; Wed 10am-5pm)"},16:{"Jenny Young":"10am-4pm (Mon 2pm-5pm & 6.30pm-8pm; Wed 10am-5pm)"},20:{"Jenny Young":"10am-4pm (Mon 2pm-5pm & 6.30pm-8pm; Wed 10am-5pm)"},21:{"Jenny Young":"10am-4pm (Mon 2pm-5pm & 6.30pm-8pm; Wed 10am-5pm)"},23:{"Jenny Young":"10am-4pm (Mon 2pm-5pm & 6.30pm-8pm; Wed 10am-5pm)"},27:{"Jenny Young":"10am-4pm (Mon 2pm-5pm & 6.30pm-8pm; Wed 10am-5pm)"} } },
  { venue:"80", lat:51.707418, lng:-0.365718, siteName:"Artists in the Wood", days:{ 5:{"Lynne Watkins":"11am-4pm","Sarah How":"11am-4pm","Wendy How":"11am-4pm"},9:{"Lynne Watkins":"11am-4pm","Sarah How":"11am-4pm","Wendy How":"11am-4pm"},12:{"Lynne Watkins":"11am-4pm","Sarah How":"11am-4pm","Wendy How":"11am-4pm"},16:{"Lynne Watkins":"11am-4pm","Sarah How":"11am-4pm","Wendy How":"11am-4pm"},23:{"Lynne Watkins":"11am-4pm","Sarah How":"11am-4pm","Wendy How":"11am-4pm"},26:{"Lynne Watkins":"11am-4pm","Sarah How":"11am-4pm","Wendy How":"11am-4pm"},27:{"Lynne Watkins":"11am-4pm","Sarah How":"11am-4pm","Wendy How":"11am-4pm"} } },
  { venue:"81", lat:51.7220131, lng:-0.338519, days:{ 6:{"Suzi Clark Artist":"Wed: 11am-1.30pm & 4.30pm-6pm; Sun: 3pm-5.30pm"},9:{"Suzi Clark Artist":"Wed: 11am-1.30pm & 4.30pm-6pm; Sun: 3pm-5.30pm"},13:{"Suzi Clark Artist":"Wed: 11am-1.30pm & 4.30pm-6pm; Sun: 3pm-5.30pm"},16:{"Suzi Clark Artist":"Wed: 11am-1.30pm & 4.30pm-6pm; Sun: 3pm-5.30pm"},20:{"Suzi Clark Artist":"Wed: 11am-1.30pm & 4.30pm-6pm; Sun: 3pm-5.30pm"},23:{"Suzi Clark Artist":"Wed: 11am-1.30pm & 4.30pm-6pm; Sun: 3pm-5.30pm"} } },
  { venue:"82", lat:51.7503251, lng:-0.3403303, days:{ 5:{"Mella Kelly":"12noon-6pm (Sat/Sun 11am-5pm)"},6:{"Mella Kelly":"12noon-6pm (Sat/Sun 11am-5pm)"},7:{"Mella Kelly":"12noon-6pm (Sat/Sun 11am-5pm)"},8:{"Mella Kelly":"12noon-6pm (Sat/Sun 11am-5pm)"},9:{"Mella Kelly":"12noon-6pm (Sat/Sun 11am-5pm)"},10:{"Mella Kelly":"12noon-6pm (Sat/Sun 11am-5pm)"},11:{"Mella Kelly":"12noon-6pm (Sat/Sun 11am-5pm)"},12:{"Mella Kelly":"12noon-6pm (Sat/Sun 11am-5pm)"},13:{"Mella Kelly":"12noon-6pm (Sat/Sun 11am-5pm)"},14:{"Mella Kelly":"12noon-6pm (Sat/Sun 11am-5pm)"},15:{"Mella Kelly":"12noon-6pm (Sat/Sun 11am-5pm)"},16:{"Mella Kelly":"12noon-6pm (Sat/Sun 11am-5pm)"},17:{"Mella Kelly":"12noon-6pm (Sat/Sun 11am-5pm)"},18:{"Mella Kelly":"12noon-6pm (Sat/Sun 11am-5pm)"},19:{"Mella Kelly":"12noon-6pm (Sat/Sun 11am-5pm)"},20:{"Mella Kelly":"12noon-6pm (Sat/Sun 11am-5pm)"} } },
  { venue:"83", lat:51.755225493287, lng:-0.35177501230315, days:{ 11:{"Dacorum & Chiltern Potters Guild (DCPG)":"10am-5pm"},12:{"Dacorum & Chiltern Potters Guild (DCPG)":"10am-5pm"},13:{"Dacorum & Chiltern Potters Guild (DCPG)":"10am-5pm"} } },
];

const ARTIST_INFO = {
  "Mitzie Green": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/Yorkshire-Moors.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/mitzie-green/" },
  "Suzi Clark Artist": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/Susi-Clark.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/suzi-clark-artist/" },
  "Gill Ayre": { types:["Book & Paper Arts","Mixed Media 2D","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/IMG_20260407_185101.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/gill-ayre/" },
  "Dave Nelson": { types:["Mixed Media 2D","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/Sennen_Cove-Dave_Nelson.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/dave-nelson/" },
  "Victoria Perloff": { types:["Book & Paper Arts","Drawing","Painting","Printmaking"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/IMG_2652.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios/victoria-perloff-bahons/" },
  "Beatrice Giacomini": { types:["Mixed Media 2D","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/Beatrice-Giacomini-blue-reflection.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/beatrice-giacomini/" },
  "Linda Gifford": { types:["Digital Art","Drawing","Multi-disciplinary","Painting","Textiles"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/IMG_20260414_162004.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/linda-gifford/" },
  "Fiona Booy": { types:["Ceramics"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/Fiona-Booy-1-1.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/fiona-booy/" },
  "Sue Peterson Mosaics": { types:["Mosaics"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/SPeterson-Flame-Tree-ST.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/sue-peterson-mosaics/" },
  "Mandy Johnson": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/Love.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios/mandy-johnson/" },
  "Becky Ullah": { types:["Drawing","Illustration","Mixed Media 2D","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/Open-Studios-Thumbnail-2026.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/becky-ullah/" },
  "Clay with Carole": { types:["Ceramics"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/1000056307.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/clay-with-carole/" },
  "Mark Davies": { types:["Digital Art"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/MarkDavies_Old_Man_Reading_Newspaper.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/markdaviesimages-from-digital-process-to-painted-image/" },
  "Daniella Coronel Saavedra": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/IMG_0096-1.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios/daniella-coronel-saavedra/" },
  "Elif Lewis": { types:["Ceramics","Mixed Media 2D"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/e8de372d-bfbd-43d4-866c-dfe930f3e623-1_all_68911-1.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/elif-lewis/", venueProfiles:{"61":"https://www.hvaf.org.uk/open-studios/elif-lewis/","62":"https://www.hvaf.org.uk/open-studios-group/elif-lewis/"} },
  "Philippa Bicknell": { types:["Mixed Media 2D","Painting","Printmaking"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/The-Boat-1.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/philippa-bicknell/" },
  "Mishi Rehal": { types:["Calligraphy & Lettering","Illustration","Painting","Printmaking"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/MREHAL.GLASS_.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/mishi-rehal/" },
  "Gerry Wilmer": { types:["Book & Paper Arts","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/IMG_1143.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios/gerry-wilmer/" },
  "Judith Moule": { types:["Mixed Media 2D","Printmaking"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/IMG_0871.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios/judith-moule/" },
  "Tg Art (Toni Gates)": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/20260412_204252-1.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/tg-art-toni-gates/" },
  "Victor Child": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/Xmas-2025-030-e1774965544455.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/victor-child/" },
  "Laura Donaldson": { types:["Drawing","Mixed Media 2D","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/Light-Lands-3.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios/laura-donaldson/" },
  "Jan Elliott": { types:["Painting","Sculpture"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/The-Edge-of-Wonder-Jan-Elliott.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/jan-elliott/" },
  "Geoffrey Howe": { types:["Mixed Media 2D","Painting","Printmaking"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/GeoffreyHowe_424Ash-ST.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/geoffrey-howe/" },
  "Jo Charlton": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/IMG_1748.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/jo-charlton/" },
  "Jenny Robinson": { types:["Mixed Media 2D","Painting","Printmaking"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/JRobinson-Before-Flight-IV.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios/jenny-robinson/" },
  "Diane Bedser": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/Diane-Bedser-ST.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/diane-bedser/" },
  "Yoshie Allan": { types:["Illustration","Mixed Media 2D","Mixed Media 3D"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/yoshieallan_tears-of-joy-01-c-tr-sq.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/yoshie-allan/" },
  "Jessica Ozlo": { types:["Textiles"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/J.Ozlo-TransformacionesOrganicas-3.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios/jessica-ozlo-2/" },
  "Shannon Lane's Dreamworlds": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/SLane_TheNothing.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/shannon-lanes-dreamworlds/" },
  "Francesca Ricciardi": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/FRicciardi_Lostinourlove.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/francesca-ricciardi/" },
  "One Creative Ape": { types:["Ceramics","Sculpture"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/One-Creative-Ape-Moon-Jars-003.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/one-creative-ape/" },
  "Gabriela Moad": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/Gabriela-Moad2IMG_2766.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/gabriela-moad/" },
  "Bob Goodall": { types:["Drawing","Mixed Media 2D","Mixed Media 3D","Multi-disciplinary","Painting","Photography & Film","Sculpture"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/Open-studio-3-2026.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/bob-goodall/" },
  "Carrie Cook": { types:["Textiles"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/Carrie-Cook_life-in-the-cracks.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/carrie-cook/" },
  "Lynne Bruges": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/LBRUGES_END_OF_THE_DAY.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/lynne-bruges/" },
  "Hetal Asher Babla": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/HBabla_Roots-of-Rhythm.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/hetal-asher-babla/" },
  "Jo Cooper Jewellery": { types:["Jewellery"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/Jo-Cooper-Jewellery-Snow-Quartz-Ring.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/jo-cooper/" },
  "Chloe Deltufo": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/CDeltufo_Core.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/chloe-deltufo/" },
  "Marta Nicholson": { types:["Book & Paper Arts","Digital Art","Mixed Media 2D","Mixed Media 3D","Multi-disciplinary","Photography & Film","Printmaking","Textiles"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/Marta-Nicholson-intertwined.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/marta-nicholson/" },
  "Bernard Gorry": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/Bernard-Gorry.-Eyes-of-a-Lion.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/bernard-gorry/" },
  "Jenny Young": { types:["Multi-disciplinary"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/Jenny-Young-Option-1.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/jenny-young/" },
  "Kat Herrgott-Penter": { types:["Drawing","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/Throns-with-Rose-or-Mondrian-Rose.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/kat-herrgott-penter/" },
  "AnnaSilvia Dooley": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/IRENE-Portrait-1.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/annasilvia-dooley/" },
  "sonnie": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/MG_4627-Waves.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/sonnie/" },
  "Broadway Gallery": { types:[], photo:"", profileUrl:"https://www.broadway-gallery.com/" },
  "Carolyn Storey": { types:["Digital Art","Drawing","Mixed Media 2D"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Regency-Melissa-cropped-2026-Carolyn-Storey.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/carolyn-storey/" },
  "Linda-Gail": { types:["Drawing"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/20260303_104407.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/linda-gail/" },
  "Pete Greening": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/PeteGreening_051-of-2025-scaled-to-3k-px.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/pete-greening/" },
  "Maggie Barton": { types:["Glass","Mixed Media 3D"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Mellow-Tempo.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/maggie-barton/" },
  "Debbie Armstrong (Fable Jewellery)": { types:["Jewellery"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/DebbieArmstrongOS26.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/debbie-armstrong-fable-jewellery/" },
  "Bea Brown": { types:["Drawing","Mixed Media 2D","Painting","Printmaking"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Bea-Brown-Dancing-Planes-Detail.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/bea-brown-2/" },
  "Deb Manning-Webb": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/20260228_161542-1.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/deb-manning-webb/" },
  "Gillian Weddle Fine Art": { types:["Drawing"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Untitled-design-2.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/gillian-weddle-fine-art/" },
  "Val Lawson": { types:["Mixed Media 2D","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Val-Lawson-Patchwork-Rhythm.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/val-lawson/" },
  "Rowena Berliner": { types:["Glass"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/Rowena-ST.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios/rowena-berliner/" },
  "Jane Waterhouse": { types:["Book & Paper Arts","Drawing","Photography & Film","Printmaking"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/Jane-Waterhouse.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios/jane-waterhouse/" },
  "Mella Kelly": { types:["Book & Paper Arts","Digital Art","Drawing","Illustration","Mixed Media 2D","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/33/IMG_9895.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios/mella-kelly/" },
  "Claire Pringle": { types:["Ceramics"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/IMG_2900.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/claire-pringle/" },
  "Sabine Riechmann (Sabijoux Design)": { types:["Jewellery","Printmaking"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/IMG_1027.jpg-Original.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/sabine-riechmann-sabijoux-design/" },
  "Jane Carr": { types:["Illustration","Mixed Media 2D","Painting","Printmaking"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/IMG_1053.png", profileUrl:"https://www.hvaf.org.uk/open-studios-group/jane-carr/" },
  "Ahlam Conti": { types:["Book & Paper Arts","Mixed Media 3D"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Ahlam1-ST.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/ahlam-conti/" },
  "Debbie Knight": { types:["Drawing","Painting","Printmaking"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/IMG_7308-1.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/debbie-knight/" },
  "Fiona Ryan-Watson": { types:["Mixed Media 2D","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/IMG_4014.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/fiona-ryan-watson/" },
  "Barbara Burrows": { types:["Mixed Media 2D","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/IMG_2883.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/barbara-burrows/" },
  "Amanda Xuereb": { types:["Drawing","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Summer-Vibes-4-cropped.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/amanda-xuereb/" },
  "Laura Murgia": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/LMurgia-Turquoise-Bliss.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/laura-murgia/" },
  "Rosie Elizabeth Barker": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/In-The-Light-Of-The-Shrine.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/rosie-elizabeth-barker/" },
  "Jackie O'Keeffe": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Cheeky-by-Nature.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/jackie-okeeffe/" },
  "Hazel Russell": { types:["Book & Paper Arts","Mixed Media 2D","Painting","Photography & Film","Printmaking","Textiles"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Hazel-Russell-Across-the-Light.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/hazel-russell/" },
  "Abigail Lagden (Curiously Contrary)": { types:["Mixed Media 3D","Painting","Sculpture","Textiles"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/1000091042.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/abigail-lagden-curiously-contrary/" },
  "Chris House": { types:["Mixed Media 2D"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Chris-House-Gammaphone.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/chris-house/" },
  "Mirna Una Majer": { types:["Multi-disciplinary","Painting","Photography & Film"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/IMG_6060-1.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/mirna-una-majer/" },
  "Felicity Cooke": { types:["Printmaking","Textiles"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Flea-Cooke-replacement-1-1.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/felicity-cooke/" },
  "Sally Taylor": { types:["Digital Art","Illustration","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Stag-in-blue-grass.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/sally-taylor/" },
  "Hazel Godfrey": { types:["Mixed Media 3D","Willow Weaving & Basketry"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/H.Godfrey-Flint-pebble-and-polished-linen.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/hazel-godfrey/" },
  "Elspeth Hector": { types:["Jewellery","Textiles"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Elspeth-Hector-Star-Bracelet.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/elspeth-hector/" },
  "Teresa Newham": { types:["Painting","Printmaking"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Teresa-Newham_Juvenile-Herring-Gull.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/teresa-newham/" },
  "Lesley Pollock": { types:["Jewellery"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/IMG_5760-4.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/lesley-pollock/" },
  "May Cheung Grant": { types:["Mixed Media 2D","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/IMG_1028-1.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/may-cheung-grant/" },
  "Sue Wookey": { types:["Drawing","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Fallow-Summer-Sue-Wookey.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/sue-wookey/" },
  "Sarah Broughton": { types:["Printmaking"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/IMG_3190.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/sarah-broughton/" },
  "Heather Miller": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/2606-H-Miller-Quiet-Waters.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/heather-miller/" },
  "Lynne Watkins": { types:["Jewellery","Metalwork","Sculpture"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/L.Watkins-Stag-pendant.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/lynne-watkins/" },
  "Cal Hoy": { types:["Illustration","Mixed Media 2D","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/IMG_5248.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/cal-hoy/" },
  "Teresa West": { types:["Book & Paper Arts","Mixed Media 2D","Printmaking"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/T.-West-Industry-Hertford-SJ.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/teresa-west/" },
  "Sarah Lamb": { types:["Glass","Jewellery","Mixed Media 3D"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Sarah-Lamb-pendant-2110b9c8de775d75b58b837504801a16.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/sarah-lamb/" },
  "Paul Hillary": { types:["Mixed Media 2D","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Evanescent-Light-Unframed.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/paul-hillary/" },
  "Hillary Taylor": { types:["Book & Paper Arts","Digital Art","Drawing","Glass","Mixed Media 2D","Mixed Media 3D","Multi-disciplinary","Photography & Film","Textiles"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/HTaylor_Los-Angeles-Stories.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/hillary-taylor/" },
  "Judith Althea Fear": { types:["Drawing","Painting","Printmaking"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/J-Fear-Early-Snow-Barton-Hills.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/judith-althea-fear/" },
  "Sarah How": { types:["Mixed Media 2D","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/SHow_Betterthanyesterday-1.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/sarah-how/" },
  "Tina Hart": { types:["Mixed Media 2D"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Tunnels-60x60cm-by-Tina-Hart.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/tina-hart/" },
  "Joanne Bowes": { types:["Book & Paper Arts","Painting","Textiles"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/IMG_3632-1.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/joanne-bowes/" },
  "Susan Chester": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Susan-Chester.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/susan-chester/" },
  "Mandy Lamyman": { types:["Illustration","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/IMG_0627.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/mandy-lamyman/" },
  "Paul Hunter": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Untitled-design-1.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/paul-hunter/" },
  "Sarah Coveney-Evans": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/A-place-once-trodden.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/sarah-coveney-evans/" },
  "Danny Wilkins": { types:["Ceramics"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Danny-Wilkins-Ceramics.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/danny-wilkins/" },
  "Susan Lee Kerr": { types:["Book & Paper Arts","Mixed Media 2D","Mixed Media 3D"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/SLKerr-Lady-Cat-close-up.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/susan-lee-kerr/" },
  "Judy Century": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/PXL_20250908_121452747.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/judy-century/" },
  "Jon Hillier": { types:["Drawing","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Theodora-with-brades-50-10-01-25.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/jon-hillier-2/" },
  "Rekha Gopinath": { types:["Ceramics","Jewellery","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Rekha-Gopinth-Replacement-IMG_5219.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/rekha-gopinath/" },
  "Zoe Beaumont": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Zoe-Beaumont-sun-muted-colours-1.jpg-moo.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/zoe-beaumont/" },
  "Julia Fonnereau": { types:["Digital Art","Drawing","Painting","Printmaking"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/IMG_3644-1.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/julia-fonnereau/" },
  "Holly Casey": { types:["Mixed Media 2D","Printmaking"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/4B809C1C-F124-4D31-B81C-336C271A135D-1.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/holly-casey/" },
  "Marian Sheraidah": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Marian-Sheraidah.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/marian-sheraidah/" },
  "Sarah Bissett Scott": { types:["Book & Paper Arts","Digital Art","Photography & Film"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Bissett_Fowey_25_7420-.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/sarah-bissetts/" },
  "Miroslav Mijatovic": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Miroslav-Mijatovic-Coastal-Whispers-ST.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/miroslav-mijatovic/" },
  "Marilyn Comparetto": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Marilyn-Camparetto.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/marilyn-comparetto/" },
  "Mardleybury Gallery Group": { types:["Ceramics","Digital Art","Glass","Mixed Media 2D","Mixed Media 3D","Multi-disciplinary","Painting","Photography & Film","Sculpture"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Mardleybury-Gallery-Group-1.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/mardleybury-gallery-group/" },
  "Kat Kerr": { types:["Book & Paper Arts","Digital Art","Drawing","Illustration","Mixed Media 2D","Textiles"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Harpenden_Gold_Course_For_Printing_2.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/kat-kerr/" },
  "Gabrielle Felton": { types:["Ceramics"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/GFelton_Pierced-Heel-Vase.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/gabrielle-felton/" },
  "Emily Rae": { types:["Painting","Printmaking"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/1000103591-1.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/emily-rae/" },
  "Lisa Reissner": { types:["Ceramics"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Lisa-Reissner-ST.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/lisa-reissner/" },
  "Yves Sancier": { types:["Drawing","Mixed Media 2D","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/The-Big-Jump-cropped.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/yves-sancier/" },
  "Faiza Hassan": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Faiza-Hassan-Chasing-Light.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/faiza-hassan/" },
  "Wendy How": { types:["Jewellery","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/0829428c-a4a5-44e7-ac33-f1071e82a924.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/wendy-how/" },
  "Ros McGuirk": { types:["Jewellery"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Ros-McGuirk-Ring-with-peridot-1.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/ros-mcguirk/" },
  "Lottie Clarke": { types:["Mixed Media 2D"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Lottie-Clarke-Landscape.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/lottie-clarke/" },
  "Dave Wye": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Dave-Wye.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/dave-wye/" },
  "Gill Davies": { types:["Textiles"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Gill-Davies.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/gill-davies-3/" },
  "Irene Maye": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/IMG_1757.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/irene-maye/" },
  "Linda Noone": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Lightandshade_lindnoone.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/linda-noone/" },
  "Trumble Creative": { types:["Jewellery","Metalwork","Mixed Media 3D","Multi-disciplinary"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Trumble-Creative-Clock.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/trumble-creative/" },
  "Lagley Meadow Hall Group": { types:["Ceramics","Drawing","Illustration","Jewellery","Mixed Media 2D","Mixed Media 3D","Painting","Textiles"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Artists-at-Lagley-Meadow-Hall.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/lagley-meadow-hall-group/" },
  "Civic Centre Group": { types:["Ceramics","Drawing","Glass","Mixed Media 2D","Painting","Printmaking","Textiles","Woodwork"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Civic-Centre-Images-for-Directory-2026-14.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/civic-centre-group/" },
  "Brigid Marlin & Friends": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Brigid-Marlin-Flight-of-churches.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/brigid-marlin-friends/" },
  "Buckinghamshire Craft Guild": { types:["Book & Paper Arts","Calligraphy & Lettering","Ceramics","Drawing","Furniture","Glass","Jewellery","Leatherwork","Mixed Media 2D","Mixed Media 3D","Multi-disciplinary","Printmaking","Sculpture","Textiles","Woodwork"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/BAW-Image-for-Directory.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/the-buckinghamshire-craft-guild/" },
  "Kate Buchanan": { types:["Textiles"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/kate-buchanan-Iris-1.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/kate-buchanan/" },
  "Liz Grammenos": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/IMG_7103.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/liz-grammenos/" },
  "Jenny Thompson": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/IMG_0025.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/jenny-thompson/" },
  "warethewomanwent": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/wrethewomanwent-2.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/warethewomanwent/" },
  "Wendy Creak": { types:["Mixed Media 2D","Painting","Textiles"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/IMG_3477.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/wendy-creak/" },
  "Ruth Sacks Ceramics": { types:["Ceramics"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/IMG_0392.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/ruth-sacks-ceramics/" },
  "Angela Bull": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Echoes-Across-the-Water-1.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/angela-bull/" },
  "Jaiya Bhandari": { types:["Mixed Media 3D","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/JBhandari_Embracing-Transformation.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/jaiya-bhandari/" },
  "Penelope Picken": { types:["Book & Paper Arts"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Penelope-Picken-Book.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/penelope-picken/" },
  "Bob Notley": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/RNotley_Newday-5.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/bob-notley/" },
  "Lawrence Noone": { types:["Metalwork"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/metalguitar_lawrencenoone-EH-crop.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/lawrence-noone/" },
  "Maddy Eaton": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/MEaton_Where-the-Light-Breaks.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/maddy-eaton/" },
  "Jo Scott": { types:["Digital Art","Illustration","Painting","Printmaking"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Jo-Scott-The-Garden.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/jo-scott/" },
  "Linda Anderson": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/LAnderson_Way-Through.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/linda-anderson/" },
  "Deirdre Shepherd": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Deirdre-Shepherd-Elemental-Landscape-II-Oil-and-Gold-Leaf-on-Canvas-1-1.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/deirdre-shepherd-2/" },
  "Callum Abbott": { types:["Drawing","Mixed Media 2D"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/CAbbott_fireworks.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/callum-abbott/" },
  "Elaine Kelly": { types:["Glass","Printmaking"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/The-Swift.-Elaine-Kelly.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/elaine-kelly/" },
  "Fiona Fraser": { types:["Mixed Media 2D"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/Fiona-Fraser-ST.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/fiona-fraser/" },
  "Mary Casserley": { types:["Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/The-Rex-2.jpg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/mary-casserley/" },
  "Paula Davies-Smith": { types:["Mixed Media 2D"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/34/pdaviessmith-flowers-orange-geo.jpeg", profileUrl:"https://www.hvaf.org.uk/open-studios-group/paula-davies-smith/" },
  "Digswell Arts Artists": { types:["Book & Paper Arts","Digital Art","Drawing","Illustration","Mixed Media 2D","Mixed Media 3D","Multi-disciplinary","Painting","Printmaking"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/65/DAT-image-for-HVAF-brochure-1.jpg", profileUrl:"https://www.hvaf.org.uk/os-business-entry/digswell-arts-artists/" },
  "Picture Maker Gallery": { types:["Ceramics","Digital Art","Drawing","Furniture","Mixed Media 2D","Mosaics","Painting","Photography & Film","Printmaking","Textiles"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/65/IMG_6707-2-copy.jpg", profileUrl:"https://www.hvaf.org.uk/os-business-entry/picture-maker-gallery/" },
  "The Maker & Mind Studio": { types:["Multi-disciplinary"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/65/20250117_194902.jpg", profileUrl:"https://www.hvaf.org.uk/os-business-entry/the-maker-mind-studio/" },
  "Artists at Hill Farm Barn": { types:["Ceramics","Drawing","Illustration","Jewellery","Mixed Media 2D","Painting","Photography & Film","Sculpture"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/65/Artists-at-Hill-Farm.jpg", profileUrl:"https://www.hvaf.org.uk/os-business-entry/artists-at-hill-farm-barn/" },
  "Liliane Textiles": { types:["Textiles"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/65/Weaving-loom_Amy-Wilson-liliane-Textiles-image.jpeg", profileUrl:"https://www.hvaf.org.uk/os-business-entry/liliane-textiles/" },
  "Sarah Core Arts": { types:["Ceramics","Drawing","Sculpture"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/65/Sarah-Core-Arts-OM-899x1024-ST.jpg", profileUrl:"https://www.hvaf.org.uk/os-business-entry/sarah-core-arts/" },
  "Townhouse Ceramics Studio & Gallery": { types:["Book & Paper Arts","Ceramics","Drawing","Illustration","Multi-disciplinary","Painting"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/65/IMG_9847.jpg", profileUrl:"https://www.hvaf.org.uk/os-business-entry/townhouse-ceramics-studio-and-gallery/" },
  "H'arts in Mind Gallery": { types:["Ceramics","Digital Art","Glass","Jewellery","Mixed Media 2D","Multi-disciplinary","Painting","Sculpture","Textiles"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/65/Gareth-Doyle-art-1.jpg", profileUrl:"https://www.hvaf.org.uk/os-business-entry/harts-in-mind-gallery/" },
  "Alex McIntyre & Friends": { types:["Mixed Media 2D","Mixed Media 3D","Painting","Sculpture"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/65/Alex-McIntyre-Softening.jpg", profileUrl:"https://www.hvaf.org.uk/os-business-entry/alex-mcintyre-friends/" },
  "Earth & Ember Pottery Collective": { types:["Ceramics"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/65/EarthEmber-image0.jpeg", profileUrl:"https://www.hvaf.org.uk/os-business-entry/earth-ember-pottery-collective/" },
  "Dacorum & Chiltern Potters Guild (DCPG)": { types:["Ceramics"], photo:"https://www.hvaf.org.uk/wp-content/uploads/formidable/65/DCPG-KB-1.jpeg", profileUrl:"https://www.hvaf.org.uk/os-business-entry/dacorum-chiltern-potters-guild-dcpg-2/" },
};

// ---- SYSTEM APP STATE -----------------------------------------------
const LAT_MIN=51.600, LAT_MAX=52.030, LNG_MIN=-0.720, LNG_MAX=0.180;
const DATES = Array.from({length:23}, (_,i)=>i+5);
const TRAIL_YEAR = 2026, TRAIL_MONTH_INDEX = 8;
const DEFAULT_DATE = 5;

let selectedDate = getInitialDate();
let isListPanelOpen = false; 
let activeSelectedVenue = null;
let visitedVenues = [];
let currentLocations = locations;

// Some venues legitimately share the same building (e.g. a shared entrance
// serving several studios). Their real lat/lng must stay identical/accurate
// for directions, but we nudge each pin's on-screen PIXEL position by a small
// constant amount (not its geographic position) so overlapping pins are each
// visible and tappable at any zoom level, without ever appearing to sit over
// a different, incorrect building.
function computeMarkerPixelOffsets(locs){
  const offsets = {};
  const CLUSTER_RADIUS_M = 12; // only treat as "same building" within ~12m
  const PIXEL_RADIUS = 8;
  function distMeters(a, b){
    const R = 6371000;
    const phi1 = a.lat * Math.PI/180, phi2 = b.lat * Math.PI/180;
    const dphi = (b.lat-a.lat) * Math.PI/180, dl = (b.lng-a.lng) * Math.PI/180;
    const x = Math.sin(dphi/2)**2 + Math.cos(phi1)*Math.cos(phi2)*Math.sin(dl/2)**2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const withCoords = locs.filter(function(l){ return l.lat && l.lng; });
  const used = {};
  withCoords.forEach(function(a){
    if(used[a.venue]) return;
    const group = [a];
    withCoords.forEach(function(b){
      if(a === b || used[b.venue]) return;
      if(distMeters(a, b) <= CLUSTER_RADIUS_M) group.push(b);
    });
    if(group.length > 1){
      group.forEach(function(g, idx){
        used[g.venue] = true;
        const angle = (2 * Math.PI * idx / group.length) - Math.PI/2;
        offsets[g.venue] = [Math.cos(angle) * PIXEL_RADIUS, Math.sin(angle) * PIXEL_RADIUS];
      });
    }
  });
  return offsets;
}
const markerPixelOffsets = computeMarkerPixelOffsets(locations);

let lovedStudios = {}; 
let studioNotes = {};  
let leafletMap = null;
let markersLayer = null;
let userDotLayer = null;
let userMarker = null;

function getInitialDate(){
  const now = new Date();
  if(now.getFullYear() === TRAIL_YEAR && now.getMonth() === TRAIL_MONTH_INDEX && now.getDate() >= 5 && now.getDate() <= 27){
    return now.getDate();
  }
  return DEFAULT_DATE;
}

function ordinal(n){
  if (n % 100 >= 11 && n % 100 <= 13) return n + "th";
  switch(n % 10){
    case 1: return n + "st";
    case 2: return n + "nd";
    case 3: return n + "rd";
    default: return n + "th";
  }
}

const AVATAR_COLORS = ["#2e8b3d","#2c6fbd","#c0392b","#8e44ad","#d68910","#16a085","#e67e22","#34495e"];
function getInitials(name){
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if(parts.length === 0) return "?";
  if(parts.length === 1) return parts[0].slice(0,2).toUpperCase();
  return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
}
function avatarColorForName(name){
  let hash = 0;
  for(let i=0;i<name.length;i++){ hash = (hash*31 + name.charCodeAt(i)) % 997; }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function avatarHtml(name, extraClass){
  const cls = "artistAvatar" + (extraClass ? (" " + extraClass) : "");
  const info = ARTIST_INFO[name];
  if(info && info.photo){
    return "<img src=\"" + info.photo + "\" class=\"" + cls + "\" alt=\"\" loading=\"lazy\" " +
      "data-fallback-bg=\"" + avatarColorForName(name) + "\" data-fallback-text=\"" + getInitials(name) + "\" " +
      "onerror=\"avatarImgError(this)\">";
  }
  return "<span class=\"" + cls + "\" style=\"background:" + avatarColorForName(name) + "\">" + getInitials(name) + "</span>";
}
function avatarImgError(img){
  const span = document.createElement("span");
  span.className = img.className;
  span.style.background = img.getAttribute("data-fallback-bg");
  span.textContent = img.getAttribute("data-fallback-text");
  img.replaceWith(span);
}

document.getElementById("loginSubmitBtn").onclick = function(){
  const emailInput = document.getElementById("userEmail").value.trim();
  if(!(emailInput && emailInput.includes("@"))) {
    alert("Please enter a valid email address to start the open studio trail.");
    return;
  }
  startTrail(emailInput);
};

document.getElementById("skipEmailBtn").onclick = function(){
  startTrail();
};

document.getElementById("shareTrailBtn").onclick = function(){
  const shareUrl = window.location.href;
  const isRealUrl = /^https?:\/\//i.test(shareUrl);
  if(!isRealUrl){
    alert("Sharing only works once this page is published on the real website \u2014 right now you're viewing a preview copy, which doesn't have a real web address yet to share.");
    return;
  }
  const shareText = "Link to 2026 Open Studio Trail";
  document.getElementById("shareWhatsappLink").href = "https://wa.me/?text=" + encodeURIComponent(shareText + " " + shareUrl);
  document.getElementById("shareEmailLink").href = "mailto:?subject=" + encodeURIComponent("Herts Open Studios Trail") + "&body=" + encodeURIComponent(shareText + "\n\n" + shareUrl);
  document.getElementById("shareSmsLink").href = "sms:?&body=" + encodeURIComponent(shareText + " " + shareUrl);
  document.getElementById("copyShareLinkBtn").dataset.url = shareUrl;
  document.getElementById("shareOverlay").classList.add("show");
};

document.getElementById("shareBoxClose").onclick = function(){
  document.getElementById("shareOverlay").classList.remove("show");
};

document.getElementById("shareOverlay").addEventListener("click", function(e){
  if(e.target === this) this.classList.remove("show");
});

document.getElementById("copyShareLinkBtn").onclick = function(){
  const btn = this;
  const url = btn.dataset.url || window.location.href;
  function showCopied(){
    const original = btn.textContent;
    btn.textContent = "\u2713 Copied!";
    setTimeout(function(){ btn.textContent = original; }, 2000);
  }
  const tempInput = document.createElement("textarea");
  tempInput.value = url;
  tempInput.style.position = "fixed";
  tempInput.style.opacity = "0";
  document.body.appendChild(tempInput);
  tempInput.focus();
  tempInput.select();
  let copied = false;
  try { copied = document.execCommand("copy"); } catch(e){ copied = false; }
  document.body.removeChild(tempInput);
  if(copied){
    showCopied();
  } else if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(showCopied).catch(function(){
      alert("Couldn't copy automatically. Link: " + url);
    });
  } else {
    alert("Couldn't copy automatically. Link: " + url);
  }
};

function startTrail(email){
  document.getElementById("loginOverlay").classList.add("hide");
  initLeafletMap();
  fitMapToAllLocations();
  buildDateSheet();
  updateTopSummary();
  renderMap();
  initGeolocation();
  setTimeout(function(){ if(leafletMap) leafletMap.invalidateSize(); }, 50);

  supabaseReady = initSupabase().then(function(){
    // Re-render now that this visitor's saved loves/visited venues (if any)
    // have loaded from Supabase.
    renderMap();
    if(isListPanelOpen) buildListView();

    // If they entered an email on the welcome screen, save it against their
    // anon user id now that we have one.
    if(email && supabaseClient && currentUserId){
      supabaseClient.from("profiles").upsert(
        { user_id: currentUserId, email: email },
        { onConflict: "user_id" }
      ).then(function(res){ if(res.error) console.error("welcome email save failed:", res.error); });
    }

    // One session_start event per page load. `src` is read from the URL
    // (e.g. add ?src=qr to a printed flyer link, ?src=instagram to a social
    // post) so referrer source can be tracked reliably even when the
    // browser's own referrer is blank (which is typical for QR scans).
    const srcParam = new URLSearchParams(window.location.search).get("src");
    logEvent("session_start", null, {
      device: detectDevice(),
      referrer: document.referrer || "",
      src: srcParam || "",
      screen_w: window.screen ? window.screen.width : null,
      screen_h: window.screen ? window.screen.height : null
    });
  });
}

function focusOnVenue(loc, focusArtist){
  activeSelectedVenue = loc.venue;
  renderMap();
  if(loc.lat && loc.lng && leafletMap) leafletMap.setView([loc.lat, loc.lng], 16, { animate:false });
  openPanel(loc, focusArtist);
}

function initLeafletMap(){
  if(leafletMap) return;
  leafletMap = L.map("mapCanvas", { zoomControl: true }).setView(
    [(LAT_MIN+LAT_MAX)/2, (LNG_MIN+LNG_MAX)/2], 14
  );
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors"
  }).addTo(leafletMap);
  markersLayer = L.layerGroup().addTo(leafletMap);
  userDotLayer = L.layerGroup().addTo(leafletMap);
}

function fitMapToAllLocations(){
  if(!leafletMap) return;
  const pts = currentLocations.map(function(l){ return [l.lat, l.lng]; }).filter(function(p){ return p[0] && p[1]; });
  if(pts.length){
    leafletMap.fitBounds(pts, { padding:[30,30], maxZoom:16, animate:false });
  }
}

function populateTypeDropdown(){
  const select = document.getElementById("artistTypeSelect");
  const allTypes = new Set();
  Object.values(ARTIST_INFO).forEach(function(info){ (info.types || []).forEach(function(t){ allTypes.add(t); }); });
  Array.from(allTypes).sort().forEach(function(type){
    const opt = document.createElement("option");
    opt.value = type;
    opt.textContent = type;
    select.appendChild(opt);
  });
}

function searchArtists(query, type){
  const q = query.trim().toLowerCase();
  if(!q && !type) return [];
  const results = [];
  currentLocations.forEach(function(loc){
    const matchesVenue = q ? loc.venue.toLowerCase().includes(q) : false;
    const namesHere = new Set();
    Object.values(loc.days).forEach(function(d){ Object.keys(d).forEach(function(n){ namesHere.add(n); }); });
    namesHere.forEach(function(artistName){
      const info = ARTIST_INFO[artistName] || { types: [] };
      const matchesName = q ? (artistName.toLowerCase().includes(q) || matchesVenue) : true;
      const matchesType = type ? info.types.includes(type) : true;
      if(matchesName && matchesType){
        results.push({ loc: loc, artistName: artistName, artistTypes: info.types });
      }
    });
  });
  return results;
}

function renderSearchResults(){
  const query = document.getElementById("artistSearchInput").value;
  const type = document.getElementById("artistTypeSelect").value;
  const box = document.getElementById("artistSearchResults");
  const countLine = document.getElementById("searchResultCount");
  box.innerHTML = "";

  if(!query.trim() && !type){
    box.innerHTML = "";
    countLine.textContent = "";
    return;
  }

  const results = searchArtists(query, type);
  if(results.length === 0){
    countLine.textContent = "";
    box.innerHTML = "<div class=\"searchHint\">No studios found. Try searching for an artist, art type or venue.</div>";
    return;
  }

  const uniqueVenues = new Set(results.map(function(r){ return r.loc.venue; })).size;
  if(query.trim()){
    countLine.textContent = results.length + " artist" + (results.length===1?"":"s") + " found";
  } else {
    countLine.textContent = uniqueVenues + " studio" + (uniqueVenues===1?"":"s") + " found";
  }

  results.forEach(function(r){
    const row = document.createElement("div");
    row.className = "searchResultRow";
    row.innerHTML =
      "<div style=\"display:flex;align-items:center;gap:8px;\">" +
        avatarHtml(r.artistName, "srAvatar") +
        "<div>" +
          "<div class=\"srName\">" + r.artistName + (r.artistTypes||[]).map(function(t){ return "<span class=\"srType\">" + t + "</span>"; }).join("") + "</div>" +
          "<div class=\"srMeta\">" + (r.loc.siteName ? (r.loc.siteName + " \u00b7 ") : "") + "Venue " + r.loc.venue + "</div>" +
        "</div>" +
      "</div>";
    row.onclick = function(){
      closeSearchPanel();
      focusOnVenue(r.loc, r.artistName);
    };
    box.appendChild(row);
  });
}

function openSearchPanel(){
  document.getElementById("searchPanel").classList.add("show");
  renderSearchResults();
}
function closeSearchPanel(){
  document.getElementById("searchPanel").classList.remove("show");
}

populateTypeDropdown();
document.getElementById("searchByNameBtn").onclick = function(){
  const panel = document.getElementById("searchPanel");
  if(panel.classList.contains("show")){
    closeSearchPanel();
  } else {
    openSearchPanel();
    document.getElementById("artistSearchInput").focus();
  }
};
document.getElementById("artistSearchInput").addEventListener("input", renderSearchResults);
document.getElementById("artistTypeSelect").addEventListener("change", function(){
  openSearchPanel();
});

let userLocation = null;
function initGeolocation(){
  const statusEl = document.getElementById("locationStatus");
  if(!navigator.geolocation){
    statusEl.textContent = "📍 Location not supported by this browser";
    statusEl.style.display = "block";
    return;
  }
  navigator.geolocation.watchPosition(
    function(pos){
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      statusEl.style.display = "none";
      updateUserDot();
    },
    function(err){
      userLocation = null;
      statusEl.textContent = err.code === 1 ? "📍 Location permission denied" : "📍 Location unavailable";
      statusEl.style.display = "block";
      updateUserDot();
    },
    { enableHighAccuracy:true, maximumAge:30000, timeout:10000 }
  );
}

function handlePinTap(loc, focusArtist){
  activeSelectedVenue = loc.venue;
  openPanel(loc, focusArtist);
  renderMap();
}

function toggleVisitedVenue(venueNum) {
  // One-way: once a visitor marks a venue visited, it can't be un-marked.
  if (visitedVenues.includes(venueNum)) return;
  visitedVenues.push(venueNum);
  visitCounts[venueNum] = (visitCounts[venueNum] || 0) + 1;
  renderMap();

  if(!supabaseClient || !currentUserId) return;
  supabaseClient.from("visits").upsert(
    { user_id: currentUserId, venue: venueNum },
    { onConflict: "user_id,venue" }
  ).then(function(res){ if(res.error) console.error("visit save failed:", res.error); });
}

function toggleArtistLove(artistName) {
  // One-way: once a visitor loves an artist, it can't be un-loved.
  if (lovedStudios[artistName]) return;
  lovedStudios[artistName] = true;
  loveCounts[artistName] = (loveCounts[artistName] || 0) + 1;

  if(!supabaseClient || !currentUserId) return;
  supabaseClient.from("loves").upsert(
    { user_id: currentUserId, artist_name: artistName },
    { onConflict: "user_id,artist_name" }
  ).then(function(res){ if(res.error) console.error("love save failed:", res.error); });
}

function submitArtistNote(artistName, message) {
  const note = message.trim();
  if(!note) return;
  if(!studioNotes[artistName]) studioNotes[artistName] = [];
  // Optimistic local copy so the UI updates instantly even before the
  // Supabase write confirms / before it's refetched.
  studioNotes[artistName].push({ name: "A trail visitor", note: note });
  commentCounts[artistName] = (commentCounts[artistName] || 0) + 1;

  if(!supabaseClient || !currentUserId) return;
  supabaseClient.from("comments").insert({
    user_id: currentUserId, artist_name: artistName, note: note
  }).then(function(res){ if(res.error) console.error("comment save failed:", res.error); });
}

function shareArtist(artistName, loc){
  const venueLabel = loc.siteName ? (loc.siteName + " (Venue " + loc.venue + ")") : ("Venue " + loc.venue);
  const shareText = artistName + " \u2014 " + venueLabel + " \u2014 HVA Open Studios Trail";
  const shareUrl = getDirectionsUrl(loc.lat, loc.lng);
  if(navigator.share){
    navigator.share({ title: artistName, text: shareText, url: shareUrl }).catch(function(){});
  } else if(navigator.clipboard){
    navigator.clipboard.writeText(shareText + " \u2014 " + shareUrl).then(function(){
      alert("Copied to clipboard \u2014 paste it to forward to someone!");
    }).catch(function(){
      alert(shareText + " \u2014 " + shareUrl);
    });
  } else {
    alert(shareText + " \u2014 " + shareUrl);
  }
}

const ALL_ART_TYPES = Array.from(new Set(Object.values(ARTIST_INFO).flatMap(function(i){ return i.types || []; }))).sort();
let typeFilter = new Set();
let statusFilter = "all"; // "open" (open only) | "all" (include closed, default)

function ordinalDateLabel(d){
  return ordinal(d) + " September 2026";
}

function locMatchesTypeFilter(loc){
  if(typeFilter.size === 0) return true;
  const allArtists = new Set();
  Object.values(loc.days).forEach(function(d){ Object.keys(d).forEach(function(n){ allArtists.add(n); }); });
  return Array.from(allArtists).some(function(a){
    const t = (ARTIST_INFO[a] && ARTIST_INFO[a].types) || [];
    return t.some(function(tt){ return typeFilter.has(tt); });
  });
}

function countOpenOn(d){
  return currentLocations.filter(function(l){ return l.days[d]; }).length;
}

function countForSummary(){
  return currentLocations.filter(function(l){
    const openToday = l.days[selectedDate];
    if(statusFilter === "open" && !openToday) return false;
    return locMatchesTypeFilter(l);
  }).length;
}

function updateTopSummary(){
  const n = countForSummary();
  const typeLabel = (typeFilter.size === 1) ? (Array.from(typeFilter)[0] + " ") : "";
  const dateSpan = document.querySelector(".dateSummaryLine .dateValue");
  if(statusFilter === "open"){
    if(dateSpan) dateSpan.textContent = "on " + ordinal(selectedDate) + " September";
    document.getElementById("countSummaryLine").textContent = n + " " + typeLabel + "Studio" + (n===1?"":"s") + " open";
  } else {
    if(dateSpan) dateSpan.textContent = "in the trail on " + ordinal(selectedDate) + " September";
    document.getElementById("countSummaryLine").textContent = "Total " + n + " " + typeLabel + "Studio" + (n===1?"":"s") + " exist";
  }
  document.getElementById("artTypeFilterBtn").textContent = typeFilter.size === 0 ? "Art type ▾" : (typeFilter.size === 1 ? Array.from(typeFilter)[0] : "Multiple ▾");
  document.getElementById("artTypeFilterBtn").classList.toggle("active", typeFilter.size > 0);
  document.getElementById("closedToggleBtn").textContent = statusFilter === "all" ? "Hide closed studios" : "Show closed studios";
  document.getElementById("closedToggleBtn").classList.toggle("active", statusFilter === "all");
  document.getElementById("noResultsBanner").style.display = (n === 0) ? "block" : "none";
}

function closeAllSheets(){
  ["dateSheet","typeSheet","trailSheet"].forEach(function(id){
    document.getElementById(id).classList.remove("show");
  });
  document.getElementById("scrim").classList.remove("show");
}
function openSheet(id){
  closeAllSheets();
  document.getElementById(id).classList.add("show");
  document.getElementById("scrim").classList.add("show");
}

function buildDateSheet(){
  const wrap = document.getElementById("dateSheetList");
  wrap.innerHTML = "";
  DATES.forEach(function(d){
    const n = countOpenOn(d);
    const btn = document.createElement("button");
    btn.className = "dateOptionBtn" + (d===selectedDate ? " active" : "");
    btn.innerHTML = "<span>" + ordinalDateLabel(d) + "</span><span class=\"cnt" + (n===0?" zero":"") + "\">" + n + " open</span>";
    btn.onclick = function(){
      selectedDate = d;
      updateTopSummary();
      renderMap();
      if(isListPanelOpen) buildListView();
      closeAllSheets();
    };
    wrap.appendChild(btn);
  });
}

function buildTypeSheet(){
  const wrap = document.getElementById("typeSheetList");
  wrap.innerHTML = "";
  const allBtn = document.createElement("button");
  allBtn.className = "statusOptionBtn" + (typeFilter.size === 0 ? " active" : "");
  allBtn.textContent = "All";
  allBtn.onclick = function(){
    typeFilter.clear();
    updateTopSummary();
    renderMap();
    if(isListPanelOpen) buildListView();
    closeAllSheets();
  };
  wrap.appendChild(allBtn);
  ALL_ART_TYPES.forEach(function(t){
    const row = document.createElement("label");
    row.className = "typeCheckRow";
    row.innerHTML = "<input type=\"checkbox\" " + (typeFilter.has(t) ? "checked" : "") + "> " + t;
    row.querySelector("input").onchange = function(e){
      if(e.target.checked) typeFilter.add(t); else typeFilter.delete(t);
    };
    wrap.appendChild(row);
  });
}

function buildTrailSheet(){
  const visitedCount = visitedVenues.length;
  const lovedCount = Object.values(lovedStudios).filter(Boolean).length;
  const totalToday = countOpenOn(selectedDate);
  const stillToVisit = Math.max(totalToday - visitedCount, 0);
  document.getElementById("trailSheetBody").innerHTML =
    "<div class=\"trailStatRow\"><span class=\"lbl\">\u2713 Visited</span><span class=\"val\">" + visitedCount + "</span></div>" +
    "<div class=\"trailStatRow\"><span class=\"lbl\">\u2661 Saved</span><span class=\"val\">" + lovedCount + "</span></div>" +
    "<div class=\"trailStatRow\"><span class=\"lbl\">\u2192 Still to visit today</span><span class=\"val\">" + stillToVisit + "</span></div>" +
    "<div class=\"trailNote\">Tapping the heart saves an artist to your list. Marking a venue as visited adds it to your visited total. To keep these saved across visits, please enter your email.</div>" +
    "<button id=\"trailEnterEmailBtn\" class=\"sheetDoneBtn\" style=\"width:100%;margin-top:8px;\">Enter email</button>" +
    "<div id=\"trailEmailRow\" style=\"display:none;margin-top:8px;\">" +
      "<input type=\"email\" id=\"trailEmailInput\" placeholder=\"Enter email address\" style=\"width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #ccc;border-radius:6px;font-size:13px;margin-bottom:6px;\">" +
      "<button id=\"trailEmailSaveBtn\" class=\"sheetDoneBtn\" style=\"width:100%;\">Save</button>" +
    "</div>";

  document.getElementById("trailEnterEmailBtn").onclick = function(){
    document.getElementById("trailEmailRow").style.display = "block";
    this.style.display = "none";
  };
  document.getElementById("trailEmailSaveBtn").onclick = function(){
    const val = document.getElementById("trailEmailInput").value.trim();
    if(!(val && val.includes("@"))){
      alert("Please enter a valid email address.");
      return;
    }
    if(supabaseClient && currentUserId){
      supabaseClient.from("profiles").upsert(
        { user_id: currentUserId, email: val },
        { onConflict: "user_id" }
      ).then(function(res){
        document.getElementById("trailEmailRow").innerHTML = res.error
          ? "<div class=\"trailNote\">Sorry, couldn't save that — please try again.</div>"
          : "<div class=\"trailNote\">Saved. Your loves and visited venues on this device are now linked to your email.</div>";
        if(res.error) console.error("profile save failed:", res.error);
      });
    } else {
      document.getElementById("trailEmailRow").innerHTML = "<div class=\"trailNote\">Saved for this session.</div>";
    }
  };
}


function getDirectionsUrl(lat, lng) {
  return "https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lng;
}

function openPanel(loc, focusArtist){
  logEvent("venue_click", loc.venue);
  if(focusArtist) logEvent("artist_click", focusArtist);
  const body = document.getElementById("panelBody");
  const openToday = loc.days[selectedDate];
  const venueLabel = loc.siteName ? (loc.siteName + " \u00b7 Venue " + loc.venue) : ("Venue " + loc.venue);
  let html = "";
  let firstArtistName = null;

  // Full roster of artists who ever show at this venue (across all dates)
  const allArtistsSet = new Set();
  Object.values(loc.days).forEach(function(d){ Object.keys(d).forEach(function(n){ allArtistsSet.add(n); }); });

  let artistsToShow;
  if(focusArtist && allArtistsSet.has(focusArtist)){
    artistsToShow = [focusArtist];
  } else if(openToday){
    artistsToShow = Object.keys(openToday);
  } else {
    artistsToShow = Array.from(allArtistsSet);
  }

  artistsToShow.forEach(function(artist){
    if(!firstArtistName) firstArtistName = artist;
    const info = ARTIST_INFO[artist] || {};
    const typesHtml = (info.types && info.types.length) ? info.types.map(function(t){ return "<span class=\"srType\">" + t + "</span>"; }).join("") : "";
    const profileUrl = (info.venueProfiles && info.venueProfiles[loc.venue]) || info.profileUrl || loc.profileUrl;
    const profileLinkHtml = profileUrl ? ("<a class=\"profileLink\" href=\"" + profileUrl + "\" target=\"_blank\" rel=\"noopener\">View Profile \u2197</a><span class=\"newTabHintInline\"> (opens in new tab)</span>") : "";
    const hrsToday = openToday && openToday[artist];
    const scheduleText = hrsToday ? (venueLabel + " \u00b7 " + hrsToday) : (venueLabel + " \u00b7 Closed on " + ordinal(selectedDate) + " September");
    const bigPhotoHtml = info.photo
      ? ("<img src=\"" + info.photo + "\" class=\"panelArtistPhoto\" alt=\"\" loading=\"lazy\" " +
         "data-fallback-bg=\"" + avatarColorForName(artist) + "\" data-fallback-text=\"" + getInitials(artist) + "\" " +
         "onerror=\"avatarImgError(this)\">")
      : ("<div class=\"panelArtistPhoto\" style=\"background:" + avatarColorForName(artist) + ";\">" + getInitials(artist) + "</div>");
    html +=
      "<div class=\"artistRow\">" +
        bigPhotoHtml +
        "<div class=\"artistRowTop\"><span class=\"artistRowName\">" + artist + "</span>" + typesHtml + "</div>" +
        "<div class=\"artistRowMeta" + (hrsToday ? "" : " closedMsg") + "\">" + scheduleText + "</div>" +
        profileLinkHtml +
      "</div>";
  });
  if(artistsToShow.length === 0){
    html += "<h2>" + venueLabel + "</h2><div class=\"closedMsg\">Closed on " + ordinal(selectedDate) + " September.</div>";
  }
  
  const directionsUrl = getDirectionsUrl(loc.lat, loc.lng);
  const isVisited = visitedVenues.includes(loc.venue);
  const isLoved = !!(firstArtistName && lovedStudios[firstArtistName]);

  // Action order: Directions -> Love -> Comment -> Share -> Mark Visited
  html += "" +
    "<div class=\"routingSection\">" +
      "<div class=\"routingTitle\">Directions to This Venue:</div>" +
      "<div class=\"routingRow\">" +
        "<a class=\"directionsBigBtn\" href=\"" + directionsUrl + "\" target=\"_blank\" rel=\"noopener\">🗺️ Route on Google Maps</a>" +
      "</div>" +
      "<div class=\"newTabHint\">Opens in a new tab \u2014 this trail map stays open behind it.</div>" +
    "</div>" +
    "<div class=\"panelActionsRow\">" +
      "<button class=\"miniIconBtn loveMini" + (isLoved ? " active" : "") + "\" id=\"panelLoveBtn\" title=\"Love this artist\">" + (firstArtistName ? loveButtonLabel(firstArtistName) : "\u2764\ufe0f Love") + "</button>" +
      "<button class=\"miniIconBtn commentMini\" id=\"panelCommentBtn\" title=\"Comments\">" + (firstArtistName ? commentButtonLabel(firstArtistName) : "\ud83d\udcac Comment") + "</button>" +
      "<button class=\"miniIconBtn shareMini\" id=\"panelShareBtn\" title=\"Share / forward\">\u27a1\ufe0f Share</button>" +
      "<button class=\"visitedPill " + (isVisited ? "active" : "") + "\" id=\"toggleVisitAction\">" +
        visitButtonLabel(loc.venue, isVisited) +
      "</button>" +
    "</div>" +
    "<div class=\"inlineCommentPanel\" id=\"panelCommentPanel\">" +
      "<div class=\"inlineCommentList\" id=\"panelCommentList\"></div>" +
      "<div class=\"inlineCommentRow\">" +
        "<input type=\"text\" id=\"panelCommentInput\" placeholder=\"Leave a quick note...\">" +
        "<button id=\"panelCommentSend\">Send</button>" +
      "</div>" +
    "</div>";
  
  body.innerHTML = html;
  document.getElementById("panel").classList.add("show");
  document.getElementById("scrim").classList.add("show");
  
  document.getElementById("toggleVisitAction").onclick = function(){
    toggleVisitedVenue(loc.venue);
    openPanel(loc); 
  };

  if(firstArtistName){
    document.getElementById("panelLoveBtn").onclick = function(){
      toggleArtistLove(firstArtistName);
      const btn = document.getElementById("panelLoveBtn");
      btn.classList.toggle("active", !!lovedStudios[firstArtistName]);
      btn.textContent = loveButtonLabel(firstArtistName);
    };
    const commentPanel = document.getElementById("panelCommentPanel");
    const commentList = document.getElementById("panelCommentList");
    document.getElementById("panelCommentBtn").onclick = function(){
      const willShow = !commentPanel.classList.contains("show");
      commentPanel.classList.toggle("show", willShow);
      document.getElementById("panelCommentBtn").classList.toggle("active", willShow);
      if(willShow){
        renderInlineComments(commentList, firstArtistName);
        setTimeout(function(){ commentPanel.scrollIntoView({behavior:"smooth", block:"end"}); }, 50);
      }
    };
    document.getElementById("panelCommentSend").onclick = function(){
      const input = document.getElementById("panelCommentInput");
      submitArtistNote(firstArtistName, input.value);
      input.value = "";
      renderInlineComments(commentList, firstArtistName);
      document.getElementById("panelCommentBtn").textContent = commentButtonLabel(firstArtistName);
    };
    document.getElementById("panelCommentInput").onkeydown = function(e){
      if(e.key === "Enter"){
        e.preventDefault();
        document.getElementById("panelCommentSend").click();
      }
    };
  } else {
    document.getElementById("panelLoveBtn").style.display = "none";
    document.getElementById("panelCommentBtn").style.display = "none";
  }

  document.getElementById("panelShareBtn").onclick = function(){
    shareArtist(firstArtistName || venueLabel, loc);
  };
}

function closePanel(){
  activeSelectedVenue = null;
  document.getElementById("panel").classList.remove("show");
  if(!isListPanelOpen) document.getElementById("scrim").classList.remove("show");
  renderMap();
}
document.getElementById("panelClose").onclick = closePanel;

function escapeHtml(str){
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function renderCommentList(listEl, notes){
  if(!notes || notes.length === 0){
    listEl.innerHTML = "<div class=\"inlineCommentItem\" style=\"font-style:italic;color:#999;\">No comments yet — be the first!</div>";
  } else {
    listEl.innerHTML = notes.map(function(n){ return "<div class=\"inlineCommentItem\">" + escapeHtml(n.note) + "</div>"; }).join("");
  }
}

async function renderInlineComments(listEl, artistName){
  // Comments are a shared public feed (everyone on the trail sees the same
  // notes for an artist), so fetch the latest set from Supabase each time
  // the panel is opened, rather than relying only on the local cache.
  if(!supabaseClient){
    renderCommentList(listEl, studioNotes[artistName]);
    return;
  }
  listEl.innerHTML = "<div class=\"inlineCommentItem\" style=\"font-style:italic;color:#999;\">Loading comments…</div>";
  const { data, error } = await supabaseClient
    .from("comments")
    .select("note, created_at")
    .eq("artist_name", artistName)
    .order("created_at", { ascending: true });
  if(error){
    console.error("comment fetch failed:", error);
    renderCommentList(listEl, studioNotes[artistName]);
    return;
  }
  studioNotes[artistName] = data.map(function(row){ return { name: "A trail visitor", note: row.note }; });
  renderCommentList(listEl, studioNotes[artistName]);
}

function buildArtistRowActions(row, loc, artist, unvisitedColor){
  unvisitedColor = unvisitedColor || "#2e8b3d";
  const commentPanel = row.querySelector(".inlineCommentPanel");
  const commentList = row.querySelector(".inlineCommentList");
  const commentInput = row.querySelector(".inlineCommentRow input");
  const commentSendBtn = row.querySelector(".inlineCommentRow button");

  const loveBtn = row.querySelector(".loveMini");
  const commentBtn = row.querySelector(".commentMini");
  const shareBtn = row.querySelector(".shareMini");
  const visitedBtn = row.querySelector(".visitedMini");

  loveBtn.onclick = function(){
    toggleArtistLove(artist);
    loveBtn.classList.toggle("active", !!lovedStudios[artist]);
    loveBtn.textContent = loveButtonLabel(artist);
  };

  commentBtn.onclick = function(){
    const willShow = !commentPanel.classList.contains("show");
    commentPanel.classList.toggle("show", willShow);
    commentBtn.classList.toggle("active", willShow);
    if(willShow){
      renderInlineComments(commentList, artist);
      setTimeout(function(){ commentPanel.scrollIntoView({behavior:"smooth", block:"end"}); }, 50);
    }
  };

  commentSendBtn.onclick = function(){
    submitArtistNote(artist, commentInput.value);
    commentInput.value = "";
    renderInlineComments(commentList, artist);
    commentBtn.textContent = commentButtonLabel(artist);
  };

  commentInput.onkeydown = function(e){
    if(e.key === "Enter"){
      e.preventDefault();
      commentSendBtn.click();
    }
  };

  shareBtn.onclick = function(){
    shareArtist(artist, loc);
  };

  visitedBtn.onclick = function(){
    toggleVisitedVenue(loc.venue);
    const nowVisited = visitedVenues.includes(loc.venue);
    visitedBtn.classList.toggle("active", nowVisited);
    visitedBtn.textContent = visitButtonLabel(loc.venue, nowVisited);
    row.querySelector(".listDot").style.background = nowVisited ? "#6f42c1" : unvisitedColor;
  };
}

function buildListView(){
  const dateLabel = ordinal(selectedDate) + " September";
  document.getElementById("listTitle").textContent = "All Artists \u2014 " + dateLabel;
  document.getElementById("listOpenHead").textContent = "Open on " + dateLabel;
  document.getElementById("listClosedHead").textContent = "Closed on " + dateLabel;
  const openCol = document.getElementById("listOpen");
  const closedCol = document.getElementById("listClosed");
  openCol.innerHTML = ""; closedCol.innerHTML = "";
  
  currentLocations.forEach(function(loc){
    const today = loc.days[selectedDate];
    const isVisited = visitedVenues.includes(loc.venue);
    const venueLabel = loc.siteName ? (loc.siteName + " \u00b7 Venue " + loc.venue) : ("Venue " + loc.venue);
    
    if(today){
      Object.entries(today).forEach(function(entry){
        const artist = entry[0], hrs = entry[1];
        const isLoved = !!lovedStudios[artist];
        const row = document.createElement("div");
        row.className = "listRow";
        // Action order: Directions -> Love -> Comment -> Share -> Mark Visited
        row.innerHTML =
          "<div class=\"listRowMainInfo\">" +
            "<div class=\"listRowContent\">" +
              avatarHtml(artist) +
              "<span class=\"listDot\" style=\"background:" + (isVisited ? "#6f42c1" : "#2e8b3d") + "\"></span>" +
              "<span><span class=\"lname\">" + artist + "</span><span class=\"lmeta\">" + venueLabel + " \u00b7 " + hrs + "</span></span>" +
            "</div>" +
          "</div>" +
          "<div class=\"listRowActions\">" +
            "<a class=\"directionsBigBtn\" href=\"" + getDirectionsUrl(loc.lat, loc.lng) + "\" target=\"_blank\" rel=\"noopener\">🗺️ Directions</a>" +
            "<button class=\"miniIconBtn loveMini" + (isLoved ? " active" : "") + "\" title=\"Love this artist\">" + loveButtonLabel(artist) + "</button>" +
            "<button class=\"miniIconBtn commentMini\" title=\"Comments\">" + commentButtonLabel(artist) + "</button>" +
            "<button class=\"miniIconBtn shareMini\" title=\"Share / forward\">\u27a1\ufe0f Share</button>" +
            "<button class=\"visitedPill visitedMini" + (isVisited ? " active" : "") + "\" title=\"Mark as visited\">" + visitButtonLabel(loc.venue, isVisited) + "</button>" +
          "</div>" +
          "<div class=\"inlineCommentPanel\">" +
            "<div class=\"inlineCommentList\"></div>" +
            "<div class=\"inlineCommentRow\">" +
              "<input type=\"text\" placeholder=\"Leave a quick note...\">" +
              "<button>Send</button>" +
            "</div>" +
          "</div>";
        row.querySelector(".listRowContent").onclick = function(){ closeListPanel(); handlePinTap(loc, artist); };
        buildArtistRowActions(row, loc, artist);
        openCol.appendChild(row);
      });
    } else {
      const allArtists = new Set();
      Object.values(loc.days).forEach(function(d){ Object.keys(d).forEach(function(n){ allArtists.add(n); }); });
      Array.from(allArtists).forEach(function(artist){
        const isLoved = !!lovedStudios[artist];
        const row = document.createElement("div");
        row.className = "listRow";
        // Action order: Directions -> Love -> Comment -> Share -> Mark Visited
        row.innerHTML =
          "<div class=\"listRowMainInfo\">" +
            "<div class=\"listRowContent\">" +
              avatarHtml(artist) +
              "<span class=\"listDot\" style=\"background:" + (isVisited ? "#6f42c1" : "#777777") + "\"></span>" +
              "<span><span class=\"lname\">" + artist + "</span><span class=\"lmeta\">" + venueLabel + " \u00b7 Closed on " + ordinal(selectedDate) + " September</span></span>" +
            "</div>" +
          "</div>" +
          "<div class=\"listRowActions\">" +
            "<a class=\"directionsBigBtn\" href=\"" + getDirectionsUrl(loc.lat, loc.lng) + "\" target=\"_blank\" rel=\"noopener\">🗺️ Directions</a>" +
            "<button class=\"miniIconBtn loveMini" + (isLoved ? " active" : "") + "\" title=\"Love this artist\">" + loveButtonLabel(artist) + "</button>" +
            "<button class=\"miniIconBtn commentMini\" title=\"Comments\">" + commentButtonLabel(artist) + "</button>" +
            "<button class=\"miniIconBtn shareMini\" title=\"Share / forward\">\u27a1\ufe0f Share</button>" +
            "<button class=\"visitedPill visitedMini" + (isVisited ? " active" : "") + "\" title=\"Mark as visited\">" + visitButtonLabel(loc.venue, isVisited) + "</button>" +
          "</div>" +
          "<div class=\"inlineCommentPanel\">" +
            "<div class=\"inlineCommentList\"></div>" +
            "<div class=\"inlineCommentRow\">" +
              "<input type=\"text\" placeholder=\"Leave a quick note...\">" +
              "<button>Send</button>" +
            "</div>" +
          "</div>";
        row.querySelector(".listRowContent").onclick = function(){ closeListPanel(); handlePinTap(loc, artist); };
        buildArtistRowActions(row, loc, artist, "#777777");
        closedCol.appendChild(row);
      });
    }
  });
}

function openListPanel(){
  isListPanelOpen = true;
  buildListView();
  renderMap(); 
  document.getElementById("listPanel").classList.add("show");
  document.getElementById("scrim").classList.add("show");
  logEvent("view_toggle", "list");
}
function closeListPanel(){
  isListPanelOpen = false;
  renderMap(); 
  document.getElementById("listPanel").classList.remove("show");
  document.getElementById("scrim").classList.remove("show");
}

// ===== GALLERY RENDERING FUNCTION (ADDED FIX) =====
function renderGalleryGrid(todayOnly){
  todayOnly = todayOnly !== false; // default to today only
  const grid = document.getElementById("galleryGrid");
  const emptyMsg = document.getElementById("galleryEmptyMsg");
  
  if(!grid) return;
  grid.innerHTML = "";
  
  // Collect all unique artists
  const artistsSet = new Set();
  const artistVenueMap = {}; // artistName -> venue number for first appearance
  
  currentLocations.forEach(function(loc){
    const openToday = loc.days[selectedDate];
    
    if(todayOnly && !openToday) return; // skip if filtering to today only
    
    const artistsForThisVenue = todayOnly ? Object.keys(openToday || {}) : Object.keys(
      Object.values(loc.days).reduce(function(acc, dayArtists){
        Object.keys(dayArtists).forEach(function(a){ acc[a] = true; });
        return acc;
      }, {})
    );
    
    artistsForThisVenue.forEach(function(artist){
      if(!artistsSet.has(artist)){
        artistsSet.add(artist);
        artistVenueMap[artist] = loc.venue;
      }
    });
  });
  
  if(artistsSet.size === 0){
    if(emptyMsg){
      grid.parentElement.appendChild(emptyMsg);
      emptyMsg.style.display = "block";
    }
    return;
  }
  
  if(emptyMsg) emptyMsg.style.display = "none";
  
  // Build tiles
  const artists = Array.from(artistsSet).sort();
  artists.forEach(function(artist){
    const info = ARTIST_INFO[artist] || {};
    const initials = getInitials(artist);
    const color = avatarColorForName(artist);
    const venue = artistVenueMap[artist];
    
    const photoHtml = info.photo
      ? ("<img src=\"" + info.photo + "\" alt=\"\" loading=\"lazy\" style=\"width:100%;height:100%;object-fit:cover;border-radius:8px;\" " +
         "data-fallback-bg=\"" + color + "\" data-fallback-text=\"" + initials + "\" " +
         "onerror=\"avatarImgError(this)\">")
      : ("<div style=\"width:100%;height:100%;background:" + color + ";border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:700;\">" + initials + "</div>");
    
    const tile = document.createElement("div");
    tile.className = "galleryTile";
    tile.innerHTML = 
      "<div class=\"galleryTilePhoto\">" + photoHtml + "</div>" +
      "<div class=\"galleryTileCaption\">" +
        "<span class=\"galleryTileName\">" + artist + "</span>" +
        "<span class=\"galleryTileVenue\">Venue " + venue + "</span>" +
      "</div>";
    
    tile.onclick = function(){
      const loc = currentLocations.find(function(l){ return l.venue === venue; });
      if(loc){
        document.getElementById("galleryPanel").classList.remove("show");
        document.getElementById("scrim").classList.remove("show");
        handlePinTap(loc, artist);
      }
    };
    
    grid.appendChild(tile);
  });
}
// ===== END GALLERY RENDERING FUNCTION =====

document.getElementById("listToggle").onclick = openListPanel;
document.getElementById("dateSummaryBtn").onclick = function(){ buildDateSheet(); openSheet("dateSheet"); };
document.getElementById("artTypeFilterBtn").onclick = function(){ buildTypeSheet(); openSheet("typeSheet"); };
document.getElementById("closedToggleBtn").onclick = function(){
  statusFilter = (statusFilter === "all") ? "open" : "all";
  updateTopSummary();
  renderMap();
  if(isListPanelOpen) buildListView();
};
document.getElementById("myTrailBtn").onclick = function(){ buildTrailSheet(); openSheet("trailSheet"); };

// ===== MISSING BUTTON HANDLERS (ADDED FIX) =====
document.getElementById("searchByNameBtn").onclick = openSearchPanel;
document.getElementById("searchPanelClose").onclick = closeSearchPanel;
document.getElementById("trailSheetClose").onclick = function(){ closeAllSheets(); };
document.getElementById("galleryToggle").onclick = function(){
  renderGalleryGrid();
  document.getElementById("galleryPanel").classList.add("show");
  document.getElementById("scrim").classList.add("show");
  logEvent("view_toggle", "gallery");
};
document.getElementById("galleryClose").onclick = function(){
  document.getElementById("galleryPanel").classList.remove("show");
  document.getElementById("scrim").classList.remove("show");
};
document.getElementById("galleryScopeToday").onclick = function(){
  this.classList.add("active");
  document.getElementById("galleryScopeAll").classList.remove("active");
  renderGalleryGrid(true);
};
document.getElementById("galleryScopeAll").onclick = function(){
  this.classList.add("active");
  document.getElementById("galleryScopeToday").classList.remove("active");
  renderGalleryGrid(false);
};
// ===== END MISSING BUTTON HANDLERS =====

document.getElementById("resetFiltersBtn").onclick = function(){
  typeFilter.clear();
  statusFilter = "all";
  updateTopSummary();
  renderMap();
  if(isListPanelOpen) buildListView();
};
document.getElementById("typeSheetDone").onclick = function(){
  updateTopSummary();
  renderMap();
  if(isListPanelOpen) buildListView();
  closeAllSheets();
};
document.getElementById("listClose").onclick = closeListPanel;
document.getElementById("scrim").onclick = function(){ closePanel(); closeListPanel(); closeAllSheets(); };

function renderMap(){
  if(!currentLocations || !leafletMap || !markersLayer) return;
  markersLayer.clearLayers();
  updateTopSummary();

  currentLocations.forEach(function(loc){
    const openToday = loc.days[selectedDate];
    if(isListPanelOpen && !openToday) return;
    if(!loc.lat || !loc.lng) return;
    if(statusFilter === "open" && !openToday) return;
    if(typeFilter.size > 0){
      const allArtists = new Set();
      Object.values(loc.days).forEach(function(d){ Object.keys(d).forEach(function(n){ allArtists.add(n); }); });
      const matches = Array.from(allArtists).some(function(a){
        const t = (ARTIST_INFO[a] && ARTIST_INFO[a].types) || [];
        return t.some(function(tt){ return typeFilter.has(tt); });
      });
      if(!matches) return;
    }

    const latlng = [loc.lat, loc.lng];

    const isPicked = (activeSelectedVenue === loc.venue);
    const isVisited = visitedVenues.includes(loc.venue);

    let stateClass = openToday ? "open" : "closed";
    if(isVisited) stateClass = "visitedState";

    const icon = L.divIcon({
      className: "",
      html: "<div class=\"pin " + stateClass + (isPicked ? " picked" : "") + "\">" + (isVisited ? "\u2713" : loc.venue) + "</div>",
      iconSize: [15, 15],
      iconAnchor: (function(){
        const off = markerPixelOffsets[loc.venue];
        return off ? [7.5 - off[0], 7.5 - off[1]] : [7.5, 7.5];
      })()
    });

    const marker = L.marker(latlng, { icon: icon, zIndexOffset: isPicked ? 1000 : 0 });
    marker.on("click", function(){ handlePinTap(loc); });
    marker.addTo(markersLayer);
  });
}

let hasFitUserOnce = false;
function updateUserDot(){
  if(!userDotLayer) return;

  if(!userLocation){
    if(userMarker){ userDotLayer.removeLayer(userMarker); userMarker = null; }
    return;
  }

  const latlng = [userLocation.lat, userLocation.lng];
  if(userMarker){
    userMarker.setLatLng(latlng);
  } else {
    const youIcon = L.divIcon({
      className: "",
      html: "<div id=\"youAreHereDot\"><div class=\"youAreHereHalo\"></div><div class=\"youAreHereCore\"></div></div>",
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });
    userMarker = L.marker(latlng, { icon: youIcon, zIndexOffset: 2000, interactive: false }).addTo(userDotLayer);
  }

  if(!hasFitUserOnce && leafletMap){
    hasFitUserOnce = true;
    const pts = currentLocations.map(function(l){ return [l.lat, l.lng]; }).filter(function(p){ return p[0] && p[1]; });
    pts.push(latlng);
    leafletMap.fitBounds(pts, { padding:[30,30], animate:false });
  }
}

window.addEventListener("resize", function(){ if(leafletMap) leafletMap.invalidateSize(); renderMap(); });
