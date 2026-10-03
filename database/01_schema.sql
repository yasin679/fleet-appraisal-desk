/* Seafarer Annual Appraisal v2.0 — SQL Server schema (appr)
   One appraisal per seafarer per year: goals → self-evaluation → appraiser evaluation → acknowledgement → countersign → office approval.
   Matches Maritime.Appraisal.Domain (Entities.cs, AppraisalRules.cs, Comparison.cs). Business rules are quoted as BR-xx. */

CREATE SCHEMA appr;
GO

/* ---------- reference ---------- */
CREATE TABLE appr.Rank (
  RankCode        VARCHAR(4)   NOT NULL PRIMARY KEY,
  Name            NVARCHAR(60) NOT NULL,
  Department      VARCHAR(10)  NOT NULL CHECK (Department IN ('Deck','Engine','Catering')),
  Level           VARCHAR(10)  NOT NULL CHECK (Level IN ('Officer','NonOfficer')),            -- BR-01
  AppraiserRole   VARCHAR(8)   NOT NULL,                                                    -- BR-10: onboard rank code or office role
  ReviewerRole    VARCHAR(8)   NULL,                                                        -- BR-10: NULL = no countersign step
  NextRankCode    VARCHAR(4)   NULL,
  SortOrder       INT          NOT NULL
);

CREATE TABLE appr.GoalTemplate (
  GoalTemplateId  INT IDENTITY PRIMARY KEY,
  Level           VARCHAR(10)   NOT NULL CHECK (Level IN ('Officer','NonOfficer')),
  Title           NVARCHAR(120) NOT NULL,
  Category        VARCHAR(12)   NOT NULL CHECK (Category IN ('Safety','Operations','Compliance','Teamwork','Development','Conduct')),
  Target          NVARCHAR(300) NOT NULL,
  Weight          INT           NOT NULL CHECK (Weight BETWEEN 10 AND 100),
  SortOrder       INT           NOT NULL
);

CREATE TABLE appr.GoalLibrary (
  GoalLibraryId   INT IDENTITY PRIMARY KEY,
  Title           NVARCHAR(120) NOT NULL,
  Category        VARCHAR(12)   NOT NULL CHECK (Category IN ('Safety','Operations','Compliance','Teamwork','Development','Conduct')),
  Target          NVARCHAR(300) NOT NULL,
  ForGroup        VARCHAR(10)   NOT NULL CHECK (ForGroup IN ('All','Deck','Engine','Catering','Officer'))
);

CREATE TABLE appr.TrainingCourse (
  TrainingCourseId INT IDENTITY PRIMARY KEY,
  Name             NVARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE appr.Setting (
  SettingKey      VARCHAR(40)   NOT NULL PRIMARY KEY,
  Value           VARCHAR(100)  NOT NULL,
  Description     NVARCHAR(200) NOT NULL
);

/* ---------- people ---------- */
CREATE TABLE appr.Vessel (
  VesselId        VARCHAR(10)  NOT NULL PRIMARY KEY,
  Name            NVARCHAR(60) NOT NULL,
  VesselType      NVARCHAR(40) NOT NULL
);

CREATE TABLE appr.ShoreUser (
  UserCode        VARCHAR(8)   NOT NULL PRIMARY KEY,
  FullName        NVARCHAR(80) NOT NULL,
  Title           NVARCHAR(60) NOT NULL
);

CREATE TABLE appr.Seafarer (
  SeafarerId          VARCHAR(12)  NOT NULL PRIMARY KEY,
  FullName            NVARCHAR(80) NOT NULL,
  RankCode            VARCHAR(4)   NOT NULL REFERENCES appr.Rank(RankCode),
  VesselId            VARCHAR(10)  NOT NULL REFERENCES appr.Vessel(VesselId),
  JoinedYear          INT          NULL,
  RehireStatus        VARCHAR(30)  NULL,              -- written on office approval (BR-12)
  PromotionApprovedTo VARCHAR(4)   NULL REFERENCES appr.Rank(RankCode)
);
CREATE INDEX IX_Seafarer_VesselRank ON appr.Seafarer (VesselId, RankCode);

CREATE TABLE appr.SeafarerTraining (
  SeafarerId       VARCHAR(12) NOT NULL REFERENCES appr.Seafarer(SeafarerId),
  TrainingCourseId INT         NOT NULL REFERENCES appr.TrainingCourse(TrainingCourseId),
  AssignedOn       DATE        NOT NULL,
  CompletedOn      DATE        NULL,
  PRIMARY KEY (SeafarerId, TrainingCourseId)
);

/* ---------- appraisal ---------- */
CREATE TABLE appr.Appraisal (
  AppraisalId        VARCHAR(20)  NOT NULL PRIMARY KEY,            -- A{year}-{SeafarerId}
  SeafarerId         VARCHAR(12)  NOT NULL REFERENCES appr.Seafarer(SeafarerId),
  AppraisalYear      INT          NOT NULL,
  RankCode           VARCHAR(4)   NOT NULL REFERENCES appr.Rank(RankCode),   -- rank and vessel when opened
  VesselId           VARCHAR(10)  NOT NULL REFERENCES appr.Vessel(VesselId),
  Stage              VARCHAR(12)  NOT NULL DEFAULT 'Goals'
                     CHECK (Stage IN ('Goals','GoalsReview','Self','Appraiser','Ack','Reviewer','Office','Done')),
  -- self summary (BR-05)
  Achievements       NVARCHAR(1000) NULL,
  Challenges         NVARCHAR(1000) NULL,
  SupportWanted      NVARCHAR(1000) NULL,
  -- appraiser assessment (BR-07, BR-08)
  Strengths          NVARCHAR(1000) NULL,
  Improvements       NVARCHAR(1000) NULL,
  RehireRecommendation VARCHAR(20) NULL CHECK (RehireRecommendation IN ('Recommended','WithReservations','NotRecommended')),
  PromotionReadiness VARCHAR(16)  NULL CHECK (PromotionReadiness IN ('ReadyNow','ReadyNextYear','NotYetReady','NotApplicable')),
  AppraiserComment   NVARCHAR(1000) NULL,
  -- acknowledgement (BR-09)
  SeafarerAgrees     BIT          NULL,
  SeafarerComment    NVARCHAR(1000) NULL,
  -- countersign (BR-11)
  CountersignComment NVARCHAR(1000) NULL,
  -- office (BR-12)
  OfficeDecision     VARCHAR(30)  NULL CHECK (OfficeDecision IN ('Approved','ApprovedWithReservations','NotForRehire')),
  PromotionApproved  BIT          NOT NULL DEFAULT 0,
  OfficeRemarks      NVARCHAR(1000) NULL,
  UpdatedOn          DATE         NOT NULL,
  RowVersion         ROWVERSION,
  CONSTRAINT UX_Appraisal_SeafarerYear UNIQUE (SeafarerId, AppraisalYear),            -- BR-02
  CONSTRAINT CK_Appraisal_NfrRemarks CHECK (OfficeDecision IS NULL OR OfficeDecision <> 'NotForRehire' OR LEN(OfficeRemarks) > 0),
  CONSTRAINT CK_Appraisal_Disagree CHECK (SeafarerAgrees IS NULL OR SeafarerAgrees = 1 OR LEN(SeafarerComment) > 0)
);
CREATE INDEX IX_Appraisal_YearStage ON appr.Appraisal (AppraisalYear, Stage);
CREATE INDEX IX_Appraisal_VesselYear ON appr.Appraisal (VesselId, AppraisalYear);

CREATE TABLE appr.AppraisalGoal (
  AppraisalId     VARCHAR(20)   NOT NULL REFERENCES appr.Appraisal(AppraisalId),
  GoalId          VARCHAR(12)   NOT NULL,
  Title           NVARCHAR(120) NOT NULL,
  Category        VARCHAR(12)   NOT NULL CHECK (Category IN ('Safety','Operations','Compliance','Teamwork','Development','Conduct')),
  Target          NVARCHAR(300) NOT NULL,
  Weight          INT           NOT NULL CHECK (Weight BETWEEN 0 AND 100),
  SelfRating      TINYINT       NULL CHECK (SelfRating BETWEEN 1 AND 5),
  SelfNote        NVARCHAR(500) NULL,
  AppraiserRating TINYINT       NULL CHECK (AppraiserRating BETWEEN 1 AND 5),
  AppraiserNote   NVARCHAR(500) NULL,
  SortOrder       INT           NOT NULL,
  PRIMARY KEY (AppraisalId, GoalId)
);

CREATE TABLE appr.AppraisalTraining (                   -- training chosen by the appraiser (Source = 'Appraiser') or assigned by the office ('Office')
  AppraisalId      VARCHAR(20) NOT NULL REFERENCES appr.Appraisal(AppraisalId),
  TrainingCourseId INT         NOT NULL REFERENCES appr.TrainingCourse(TrainingCourseId),
  Source           VARCHAR(10) NOT NULL CHECK (Source IN ('Appraiser','Office')),
  PRIMARY KEY (AppraisalId, TrainingCourseId, Source)
);

CREATE TABLE appr.AppraisalHistory (                    -- BR-18: append-only audit trail
  HistoryId       BIGINT IDENTITY PRIMARY KEY,
  AppraisalId     VARCHAR(20)   NOT NULL REFERENCES appr.Appraisal(AppraisalId),
  ActedOn         DATETIME2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
  ActedBy         VARCHAR(12)   NOT NULL,
  Action          NVARCHAR(80)  NOT NULL,
  Note            NVARCHAR(1000) NULL
);
CREATE INDEX IX_History_Appraisal ON appr.AppraisalHistory (AppraisalId, ActedOn);

/* Closed results from earlier years (before go-live or archived), used for comparison (BR-16). */
CREATE TABLE appr.PriorResult (
  SeafarerId      VARCHAR(12)  NOT NULL REFERENCES appr.Seafarer(SeafarerId),
  ResultYear      INT          NOT NULL,
  Overall         DECIMAL(3,2) NOT NULL CHECK (Overall BETWEEN 1 AND 5),
  Safety          DECIMAL(3,2) NULL, Operations DECIMAL(3,2) NULL, Compliance DECIMAL(3,2) NULL,
  Teamwork        DECIMAL(3,2) NULL, Development DECIMAL(3,2) NULL, Conduct DECIMAL(3,2) NULL,
  Decision        VARCHAR(30)  NULL,
  PRIMARY KEY (SeafarerId, ResultYear)
);

/* ---------- benchmark data from other ship managers (BR-17) ---------- */
CREATE TABLE appr.BenchmarkSource (
  BenchmarkSourceId INT IDENTITY PRIMARY KEY,
  SourceName      NVARCHAR(120) NOT NULL,
  UploadedOn      DATE          NOT NULL,
  UploadedBy      VARCHAR(12)   NOT NULL,
  IsSample        BIT           NOT NULL DEFAULT 0,
  IsActive        BIT           NOT NULL DEFAULT 0,
  RowsLoaded      INT           NOT NULL,
  RowsSkipped     INT           NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX UX_Benchmark_OneActive ON appr.BenchmarkSource (IsActive) WHERE IsActive = 1;

CREATE TABLE appr.BenchmarkRating (
  BenchmarkRatingId BIGINT IDENTITY PRIMARY KEY,
  BenchmarkSourceId INT          NOT NULL REFERENCES appr.BenchmarkSource(BenchmarkSourceId),
  Company         NVARCHAR(60) NOT NULL,
  RankCode        VARCHAR(4)   NOT NULL REFERENCES appr.Rank(RankCode),
  RatingYear      INT          NOT NULL,
  Overall         DECIMAL(3,2) NOT NULL CHECK (Overall BETWEEN 1 AND 5),
  Safety          DECIMAL(3,2) NULL, Operations DECIMAL(3,2) NULL, Compliance DECIMAL(3,2) NULL,
  Teamwork        DECIMAL(3,2) NULL, Development DECIMAL(3,2) NULL, Conduct DECIMAL(3,2) NULL
);
CREATE INDEX IX_Benchmark_RankYear ON appr.BenchmarkRating (BenchmarkSourceId, RankCode, RatingYear);
GO

/* ---------- views ---------- */
/* BR-13: weighted overall per appraisal (self and appraiser), to 2 decimals. */
CREATE VIEW appr.vw_AppraisalScore AS
SELECT a.AppraisalId, a.SeafarerId, a.AppraisalYear, a.RankCode, a.VesselId, a.Stage,
       CAST(ROUND(SUM(CASE WHEN g.SelfRating IS NOT NULL THEN g.SelfRating * g.Weight END) * 1.0
            / NULLIF(SUM(CASE WHEN g.SelfRating IS NOT NULL THEN g.Weight END), 0), 2) AS DECIMAL(3,2)) AS SelfOverall,
       CAST(ROUND(SUM(CASE WHEN g.AppraiserRating IS NOT NULL THEN g.AppraiserRating * g.Weight END) * 1.0
            / NULLIF(SUM(CASE WHEN g.AppraiserRating IS NOT NULL THEN g.Weight END), 0), 2) AS DECIMAL(3,2)) AS AppraiserOverall
FROM appr.Appraisal a JOIN appr.AppraisalGoal g ON g.AppraisalId = a.AppraisalId
GROUP BY a.AppraisalId, a.SeafarerId, a.AppraisalYear, a.RankCode, a.VesselId, a.Stage;
GO

/* BR-16: the rating each seafarer is compared on — this year's appraiser rating once submitted, or a closed earlier result. */
CREATE VIEW appr.vw_ComparableScore AS
SELECT s.SeafarerId, s.AppraisalYear AS ScoreYear, sf.RankCode, s.AppraiserOverall AS Overall
FROM appr.vw_AppraisalScore s JOIN appr.Seafarer sf ON sf.SeafarerId = s.SeafarerId
WHERE s.Stage IN ('Ack','Reviewer','Office','Done') AND s.AppraiserOverall IS NOT NULL
UNION ALL
SELECT p.SeafarerId, p.ResultYear, sf.RankCode, p.Overall
FROM appr.PriorResult p JOIN appr.Seafarer sf ON sf.SeafarerId = p.SeafarerId
WHERE NOT EXISTS (SELECT 1 FROM appr.Appraisal a WHERE a.SeafarerId = p.SeafarerId AND a.AppraisalYear = p.ResultYear AND a.Stage IN ('Ack','Reviewer','Office','Done'));
GO

/* BR-16: fleet rank and "higher than x% of the others" within the same rank and year. */
CREATE VIEW appr.vw_FleetPosition AS
SELECT c.SeafarerId, c.ScoreYear, c.RankCode, c.Overall,
       1 + (SELECT COUNT(*) FROM appr.vw_ComparableScore o WHERE o.RankCode = c.RankCode AND o.ScoreYear = c.ScoreYear AND o.Overall > c.Overall) AS FleetRank,
       (SELECT COUNT(*) FROM appr.vw_ComparableScore o WHERE o.RankCode = c.RankCode AND o.ScoreYear = c.ScoreYear) AS FleetRated,
       (SELECT COUNT(*) FROM appr.vw_ComparableScore o WHERE o.RankCode = c.RankCode AND o.ScoreYear = c.ScoreYear AND o.Overall < c.Overall) AS FleetBelow
FROM appr.vw_ComparableScore c;
GO

/* Office dashboard: appraisals per year, vessel and stage. */
CREATE VIEW appr.vw_StageSummary AS
SELECT AppraisalYear, VesselId, Stage, COUNT(*) AS Appraisals
FROM appr.Appraisal GROUP BY AppraisalYear, VesselId, Stage;
GO
