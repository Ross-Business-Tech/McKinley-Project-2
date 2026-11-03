// All names, clinics and patients below are invented for this prototype.
// No real personal information.

export const BEFORE_DAYS = 14
export const GOAL_DAYS = 3

export const DEPARTMENTS = [
  'Cardiology',
  'Orthopedics',
  'Neurology',
  'Gastroenterology',
  'Pulmonology',
  'Endocrinology',
  'Behavioral Health',
  'Oncology',
]

export const COORDINATORS = ['Dana P.', 'Marcus L.', 'Priya S.', 'Tom W.', 'Alex R.']

export const SAMPLE_REFERRALS = [
  {
    id: 'R-1041',
    from: 'Dr. Hollis Grant, Maple Street Family Practice',
    via: 'Fax',
    waitingDays: 4,
    patient: 'Patient A (made up), 67',
    text:
      'Please see for chest pain on exertion and shortness of breath climbing stairs. ECG shows new ST changes. History of high blood pressure. Insurance: Lakeshore Health Plan. Requesting cardiology evaluation, stress test.',
  },
  {
    id: 'R-1042',
    from: 'Dr. Inez Moreau, Riverside Urgent Care',
    via: 'Email',
    waitingDays: 2,
    patient: 'Patient B (made up), 41',
    text:
      'Knee injury playing basketball 3 weeks ago, swelling and locking. MRI attached shows possible meniscus tear. Please evaluate for orthopedic surgery consult.',
  },
  {
    id: 'R-1043',
    from: 'Dr. Samuel Okafor, Northgate Internal Medicine',
    via: 'Fax',
    waitingDays: 9,
    patient: 'Patient C (made up), 58',
    text:
      'Recurring severe headaches and numbness in left hand, two episodes of blurred vision. Insurance: Bluepine Mutual. Diagnosis: suspected TIA. Please see neurology soon.',
  },
  {
    id: 'R-1044',
    from: 'Dr. Helen Park, Westbrook Clinic',
    via: 'Email',
    waitingDays: 1,
    patient: 'Patient D (made up), 52',
    text:
      'Patient due for screening colonoscopy, also reports occasional heartburn and reflux. Insurance: Lakeshore Health Plan. Diagnosis: routine screening, GERD. Recent labs normal, results attached.',
  },
  {
    id: 'R-1045',
    from: 'Dr. Raj Bhatt, Cedar Hill Pediatrics & Family',
    via: 'Fax',
    waitingDays: 6,
    patient: 'Patient E (made up), 34',
    text:
      'Ongoing anxiety and low mood for several months, trouble sleeping, affecting work. Please refer to behavioral health / counseling. Insurance: Bluepine Mutual.',
  },
  {
    id: 'R-1046',
    from: 'Dr. Lucia Fernandez, Harbor Medical Group',
    via: 'Email',
    waitingDays: 3,
    patient: 'Patient F (made up), 49',
    text:
      'A1C 9.8 despite metformin, thyroid nodule on recent ultrasound. Diagnosis: type 2 diabetes, poorly controlled. Insurance: Coastal Care. Requesting endocrinology.',
  },
  {
    id: 'R-1047',
    from: 'Dr. Owen Becker, Lakeview Primary Care',
    via: 'Fax',
    waitingDays: 12,
    patient: 'Patient G (made up), 72',
    text:
      'Chronic cough for 2 months, smoker 40 years, unintentional weight loss. Chest x-ray shows a lung mass. Please see urgently.',
  },
]
