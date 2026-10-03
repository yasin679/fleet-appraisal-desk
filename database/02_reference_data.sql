/* Reference data v2.0 — matches Maritime.Appraisal.Domain/Reference.cs */

INSERT INTO appr.Rank (RankCode, Name, Department, Level, AppraiserRole, ReviewerRole, NextRankCode, SortOrder) VALUES
('MST',N'Master','Deck','Officer','MSUPT',NULL,NULL,1),
('CO',N'Chief Officer','Deck','Officer','MST','MSUPT','MST',2),
('2O',N'Second Officer','Deck','Officer','CO','MST','CO',3),
('3O',N'Third Officer','Deck','Officer','CO','MST','2O',4),
('CE',N'Chief Engineer','Engine','Officer','MST','TSUPT',NULL,5),
('2E',N'Second Engineer','Engine','Officer','CE','MST','CE',6),
('3E',N'Third Engineer','Engine','Officer','CE','MST','2E',7),
('4E',N'Fourth Engineer','Engine','Officer','CE','MST','3E',8),
('ETO',N'Electro-Technical Officer','Engine','Officer','CE','MST',NULL,9),
('DCD',N'Deck Cadet','Deck','NonOfficer','CO','MST','3O',10),
('BSN',N'Bosun','Deck','NonOfficer','CO','MST',NULL,11),
('AB',N'Able Seaman','Deck','NonOfficer','CO','MST','BSN',12),
('OS',N'Ordinary Seaman','Deck','NonOfficer','CO','MST','AB',13),
('FTR',N'Fitter','Engine','NonOfficer','CE','MST',NULL,14),
('OLR',N'Oiler','Engine','NonOfficer','CE','MST','FTR',15),
('CCK',N'Chief Cook','Catering','NonOfficer','MST',NULL,NULL,16),
('MSM',N'Messman','Catering','NonOfficer','CCK','MST','CCK',17);

INSERT INTO appr.GoalTemplate (Level, Title, Category, Target, Weight, SortOrder) VALUES
('Officer',N'Lead safe operations in my department','Safety',N'Zero lost-time injuries; 100% drills and toolbox talks; permits to work closed correctly',25,1),
('Officer',N'Clean inspections','Compliance',N'No PSC, vetting or audit findings in my area of responsibility',20,2),
('Officer',N'Planned work on time','Operations',N'100% of PMS jobs (engine) or voyage and cargo plans (deck) done on time',20,3),
('Officer',N'Lead and develop the team','Teamwork',N'Familiarisation and on-board training complete for every junior I supervise',15,4),
('Officer',N'My own development','Development',N'All assigned CBTs complete; one competence course before next contract',20,5),
('NonOfficer',N'Work safely','Safety',N'Zero injuries; PPE and permit to work always followed; 100% drill attendance',30,1),
('NonOfficer',N'Assigned work done well','Operations',N'PMS jobs and daily work orders done on time and to standard',30,2),
('NonOfficer',N'Reliable and disciplined','Conduct',N'No warnings; work and rest hours recorded accurately',20,3),
('NonOfficer',N'Keep learning','Development',N'Assigned CBTs and training record book tasks complete',20,4);

INSERT INTO appr.GoalLibrary (Title, Category, Target, ForGroup) VALUES
(N'Mooring operations without incident','Safety',N'Zero mooring incidents; snap-back zones briefed before every operation','Deck'),
(N'Enclosed space entry done right','Safety',N'100% entries with permit, gas test and rescue team ready','All'),
(N'Cargo operations without claims','Operations',N'No cargo damage or shortage claims; stability checked every stage','Deck'),
(N'Bunkering without spills','Operations',N'Zero spills; checklist and soundings complete for every bunkering','Engine'),
(N'Fuel efficiency','Operations',N'Main engine fuel consumption within 2% of the performance curve','Engine'),
(N'Navigation records in order','Compliance',N'ECDIS, passage plans and log books 100% compliant at every audit','Deck'),
(N'Environmental records in order','Compliance',N'Oil Record Book and Garbage Record Book with no findings','All'),
(N'Mentor a cadet','Teamwork',N'Cadet''s training record book tasks for this period signed off','Officer'),
(N'Speak up for safety','Teamwork',N'At least one near-miss or improvement report each month','All'),
(N'Galley hygiene','Compliance',N'No findings in Master''s weekly galley and provisions inspection','Catering'),
(N'Food within budget','Operations',N'Victualling within the daily allowance; crew satisfaction 4 of 5 or better','Catering'),
(N'Prepare for promotion','Development',N'Complete the next-rank familiarisation and a competency check with the HOD','All'),
(N'Rest-hour compliance','Conduct',N'No MLC rest-hour non-conformities','All');

INSERT INTO appr.TrainingCourse (Name) VALUES (N'Bridge Resource Management'), (N'Engine Room Resource Management'), (N'ECDIS type-specific'), (N'Leadership & Managerial Skills'), (N'Advanced fire fighting refresher'), (N'Behavioural safety workshop'), (N'Maritime English'), (N'Food safety & hygiene'), (N'Cargo handling & stability'), (N'High-voltage safety'), (N'Enclosed space entry & rescue'), (N'Mooring safety');

INSERT INTO appr.Setting (SettingKey, Value, Description) VALUES
('AppraisalPeriod','CalendarYear',N'One appraisal per seafarer per calendar year (BR-02)'),
('RatingScale','1-5',N'1 Unsatisfactory, 2 Needs improvement, 3 Meets expectations, 4 Exceeds expectations, 5 Outstanding'),
('NoteRequiredFor','1,2,5',N'Ratings that need a written comment or evidence (BR-05, BR-07)'),
('MinGoals','3',N'Fewest goals per year (BR-03)'),
('MaxGoals','6',N'Most goals per year (BR-03)'),
('MinGoalWeight','10',N'Smallest weight for one goal, % (BR-03)'),
('MinSafetyWeight','20',N'Smallest weight for the Safety goal, % (BR-03)'),
('RecommendedMinOverall','2.50',N'Re-hire ''Recommended'' needs this overall or more (BR-08)'),
('RecommendedMinSafety','3',N'...and this Safety rating or more (BR-08)'),
('ReadyNowMinOverall','3.50',N'Promotion ''Ready now'' needs this overall or more (BR-08)'),
('ReadyNowMinSafety','4',N'...and this Safety rating or more (BR-08)'),
('TrainingAtOrBelow','2',N'Training is required for any goal rated at or below this (BR-08)'),
('ApprovedMinOverall','2.50',N'Office ''Approved'' needs this overall or more (BR-12)'),
('Bands','Outstanding>=4.50;Exceeds>=3.50;Meets>=2.50;NeedsImprovement>=1.50',N'Score bands (BR-13)'),
('SmallGroup','4',N'Fewer other rated peers than this: comparison flagged ''read with care'' (BR-16)');

INSERT INTO appr.ShoreUser (UserCode, FullName, Title) VALUES
('MSUPT',N'Capt. Neil Fernandes',N'Marine Superintendent'),('TSUPT',N'Priya Nair',N'Technical Superintendent'),('CREWING',N'Farah Khan',N'Crewing Manager'),('ADMIN',N'Rohit Kulkarni',N'HR Systems Administrator');
