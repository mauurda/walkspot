import { Route, Routes } from "react-router";
import { Home } from "./home/Home";
import { NewEvent } from "./home/NewEvent";
import { HuntLayout } from "./hunt/HuntLayout";
import { Challenges } from "./hunt/Challenges";
import { ChallengeDetail } from "./hunt/ChallengeDetail";
import { MapRoute } from "./hunt/MapRoute";
import { Feed } from "./hunt/Feed";
import { Board } from "./hunt/Board";
import { OrganizerLayout } from "./organizer/OrganizerLayout";
import { People } from "./organizer/People";
import { ChallengeEditor } from "./organizer/ChallengeEditor";
import { Review } from "./organizer/Review";
import { Settings } from "./organizer/Settings";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/new" element={<NewEvent />} />
      <Route path="/e/:code" element={<HuntLayout />}>
        <Route index element={<Challenges />} />
        <Route path="c/:id" element={<ChallengeDetail />} />
        <Route path="map" element={<MapRoute />} />
        <Route path="feed" element={<Feed role="participant" />} />
        <Route path="board" element={<Board role="participant" />} />
      </Route>
      <Route path="/o/:code" element={<OrganizerLayout />}>
        <Route index element={<People />} />
        <Route path="challenges" element={<ChallengeEditor />} />
        <Route path="review" element={<Review />} />
        <Route path="feed" element={<Feed role="organizer" />} />
        <Route path="board" element={<Board role="organizer" />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
