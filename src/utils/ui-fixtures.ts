/**
 * Visual development demo fixtures - temporary mock data for UI testing and layout prototyping.
 * Note: These are NOT live database statistics.
 */

export interface UIResource {
  id: string
  title: string
  code: string
  category: 'Laboratory' | 'Fabrication' | 'Computing' | 'Media & AV' | 'Field Research'
  department: string
  location: string
  custodian: string
  imageUrl: string
  condition: 'Excellent' | 'Good' | 'Fair'
  status: 'available' | 'reserved' | 'in-use' | 'maintenance'
  maxDurationDays: number
  depositRequired: boolean
  depositAmount?: number
  specifications: Record<string, string>
  rating: number
  reviewsCount: number
  description: string
}

export interface UIBooking {
  id: string
  resourceId: string
  resourceTitle: string
  resourceCode: string
  resourceCategory: string
  seekerName: string
  seekerRole: string
  startDate: string
  endDate: string
  status: 'approved' | 'pending' | 'in-use' | 'returned' | 'overdue' | 'rejected'
  purpose: string
  checkInCode: string
  qrData: string
  supervisorApproval: boolean
}

export interface UIStatItem {
  label: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  description?: string
  icon: string
}

export const DEMO_RESOURCES: UIResource[] = [
  {
    id: 'res-01',
    title: 'Benchtop Scanning Electron Microscope (SEM)',
    code: 'LAB-MAT-884',
    category: 'Laboratory',
    department: 'Materials Science & NanoTech',
    location: 'Advanced Materials Wing, Room 302',
    custodian: 'Dr. Aris Thorne (Materials Dept)',
    imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
    condition: 'Excellent',
    status: 'available',
    maxDurationDays: 3,
    depositRequired: true,
    depositAmount: 150,
    specifications: {
      'Magnification': 'Up to 100,000x',
      'Vacuum System': 'Turbo-molecular + Rotary pump',
      'Detector': 'Secondary & Backscattered Electron',
      'Training Required': 'Level 2 Certified Operator'
    },
    rating: 4.9,
    reviewsCount: 38,
    description: 'High-throughput benchtop SEM designed for high resolution surface topography and compositional imaging across nanoscale biomaterials and metal alloys.'
  },
  {
    id: 'res-02',
    title: 'Industrial Selective Laser Sintering (SLS) 3D Printer',
    code: 'FAB-MECH-412',
    category: 'Fabrication',
    department: 'Mechanical Engineering Hub',
    location: 'Prototyping Foundry, Bay 04',
    custodian: 'Elena Rostova (Lab Manager)',
    imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
    condition: 'Excellent',
    status: 'in-use',
    maxDurationDays: 5,
    depositRequired: false,
    specifications: {
      'Build Volume': '300 x 300 x 300 mm',
      'Material Compatibility': 'Nylon PA12, TPU, Carbon-filled',
      'Laser Type': '30W CO2 Laser',
      'Software': 'LoopCAM Slicer Pro v4'
    },
    rating: 4.8,
    reviewsCount: 64,
    description: 'Professional grade additive manufacturing for functional end-use prototypes with isotropic mechanical strength and complex geometries.'
  },
  {
    id: 'res-03',
    title: 'NVIDIA HGX H100 GPU Compute Node (4x 80GB)',
    code: 'HPC-CS-109',
    category: 'Computing',
    department: 'School of Computer Science & AI',
    location: 'Central Data Center, Rack 14B',
    custodian: 'Compute Infrastructure Team',
    imageUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80',
    condition: 'Excellent',
    status: 'available',
    maxDurationDays: 7,
    depositRequired: false,
    specifications: {
      'Accelerators': '4x NVIDIA H100 80GB SXM5',
      'Interconnect': 'NVLink 900 GB/s bidirectional',
      'Host Memory': '1.5 TB DDR5 ECC RAM',
      'Storage': '30 TB NVMe Scratch Array'
    },
    rating: 5.0,
    reviewsCount: 92,
    description: 'Dedicated deep learning partition for graduate researchers training multi-billion parameter foundation models and scientific simulations.'
  },
  {
    id: 'res-04',
    title: 'Sony FX6 Full-Frame Cinema Field Kit',
    code: 'MED-COMM-520',
    category: 'Media & AV',
    department: 'Film, Media & Communications',
    location: 'Media Equipment Vault, Locker 12',
    custodian: 'Prof. Marcus Vance',
    imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80',
    condition: 'Good',
    status: 'reserved',
    maxDurationDays: 4,
    depositRequired: true,
    depositAmount: 100,
    specifications: {
      'Sensor': '4K Full-Frame Back-Illuminated Exmor R',
      'Lenses Included': '24-70mm f/2.8 GM, 70-200mm f/2.8 GM',
      'Audio': 'Dual XLR with Sennheiser Shotgun Mic',
      'Power': '3x V-Mount High Capacity Packs'
    },
    rating: 4.7,
    reviewsCount: 45,
    description: 'Complete documentary and field research broadcast camera system including stabilization cage, wireless lavaliers, and Pelican flight cases.'
  },
  {
    id: 'res-05',
    title: 'Survey-Grade RTK Multirotor LiDAR Drone',
    code: 'ENV-GEO-299',
    category: 'Field Research',
    department: 'Earth & Environmental Sciences',
    location: 'Field Research Depot, Room 114',
    custodian: 'Dr. Sarah Lin (Geodesy Lab)',
    imageUrl: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=800&q=80',
    condition: 'Excellent',
    status: 'available',
    maxDurationDays: 2,
    depositRequired: true,
    depositAmount: 200,
    specifications: {
      'Sensor': 'Livox Mid-360 LiDAR + 45MP RGB',
      'Positioning': 'Centimeter-level RTK GPS Base',
      'Flight Duration': '42 min per dual battery pack',
      'License': 'Institutional Pilot Credential required'
    },
    rating: 4.9,
    reviewsCount: 29,
    description: 'Autonomous spatial mapping platform capturing high-density 3D digital elevation models and forest canopy penetrations.'
  },
  {
    id: 'res-06',
    title: 'Keysight 4-Channel 1GHz Digital Phosphor Oscilloscope',
    code: 'LAB-ECE-630',
    category: 'Laboratory',
    department: 'Electrical & Computer Engineering',
    location: 'Circuits & Embedded Systems Lab 208',
    custodian: 'David Chang (Lab Engineer)',
    imageUrl: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80',
    condition: 'Good',
    status: 'maintenance',
    maxDurationDays: 14,
    depositRequired: false,
    specifications: {
      'Bandwidth': '1.0 GHz with InfiniiVision tech',
      'Sample Rate': '5 GSa/s per channel',
      'Decoding': 'I2C, SPI, CAN, PCIe bus decoding',
      'Probes': '4x High Impedance Passive Probes'
    },
    rating: 4.6,
    reviewsCount: 51,
    description: 'Essential testbench instrument for high frequency signal analysis, mixed-signal debugging, and embedded protocol decoding.'
  }
]

export const DEMO_BOOKINGS: UIBooking[] = [
  {
    id: 'bk-901',
    resourceId: 'res-01',
    resourceTitle: 'Benchtop Scanning Electron Microscope (SEM)',
    resourceCode: 'LAB-MAT-884',
    resourceCategory: 'Laboratory',
    seekerName: 'Jatin Kumar (Graduate Researcher)',
    seekerRole: 'Student Seeker',
    startDate: '2026-11-02',
    endDate: '2026-11-04',
    status: 'approved',
    purpose: 'Carbon nanotube composite tensile fracture surface imaging for thesis research.',
    checkInCode: 'RL-9012-SEM',
    qrData: 'RL-TOKEN-9012:MAT884:USER-JATIN',
    supervisorApproval: true
  },
  {
    id: 'bk-902',
    resourceId: 'res-03',
    resourceTitle: 'NVIDIA HGX H100 GPU Compute Node (4x 80GB)',
    resourceCode: 'HPC-CS-109',
    resourceCategory: 'Computing',
    seekerName: 'Jatin Kumar (Graduate Researcher)',
    seekerRole: 'Student Seeker',
    startDate: '2026-11-05',
    endDate: '2026-11-10',
    status: 'in-use',
    purpose: 'Fine-tuning multimodal vision-language models on institutional archive datasets.',
    checkInCode: 'RL-4410-HPC',
    qrData: 'RL-TOKEN-4410:HPC109:USER-JATIN',
    supervisorApproval: true
  },
  {
    id: 'bk-903',
    resourceId: 'res-04',
    resourceTitle: 'Sony FX6 Full-Frame Cinema Field Kit',
    resourceCode: 'MED-COMM-520',
    resourceCategory: 'Media & AV',
    seekerName: 'Aarav Patel',
    seekerRole: 'Media Fellow',
    startDate: '2026-11-12',
    endDate: '2026-11-15',
    status: 'pending',
    purpose: 'Annual engineering symposium keynote interviews and documentary captures.',
    checkInCode: 'RL-7781-FX6',
    qrData: 'RL-TOKEN-7781:MED520:USER-AARAV',
    supervisorApproval: false
  },
  {
    id: 'bk-904',
    resourceId: 'res-05',
    resourceTitle: 'Survey-Grade RTK Multirotor LiDAR Drone',
    resourceCode: 'ENV-GEO-299',
    resourceCategory: 'Field Research',
    seekerName: 'Jatin Kumar (Graduate Researcher)',
    seekerRole: 'Student Seeker',
    startDate: '2026-10-20',
    endDate: '2026-10-22',
    status: 'returned',
    purpose: 'Riverbank erosion photogrammetry along the North Campus drainage corridor.',
    checkInCode: 'RL-3312-DRN',
    qrData: 'RL-TOKEN-3312:GEO299:USER-JATIN',
    supervisorApproval: true
  }
]

export const DEMO_SEEKER_STATS: UIStatItem[] = [
  { label: 'Active Reservations', value: 2, change: '+1 upcoming', changeType: 'positive', icon: 'Calendar' },
  { label: 'Verified Check-outs', value: 14, change: '100% on-time', changeType: 'positive', icon: 'CheckCircle2' },
  { label: 'Institutional Trust Score', value: '98 / 100', change: 'Tier 1 Certified', changeType: 'positive', icon: 'ShieldCheck' },
  { label: 'Est. Capital Saved', value: '$18,400', change: 'Cross-sharing', changeType: 'positive', icon: 'Coins' }
]

export const DEMO_OWNER_STATS: UIStatItem[] = [
  { label: 'Managed Assets', value: 12, change: 'Across 3 labs', changeType: 'neutral', icon: 'Layers' },
  { label: 'Asset Utilization Rate', value: '78.4%', change: '+14% vs last quarter', changeType: 'positive', icon: 'Activity' },
  { label: 'Pending Approvals', value: 3, change: 'Requires review', changeType: 'neutral', icon: 'Clock' },
  { label: 'Departmental Credits', value: '4,250 pts', change: 'Reinvestable in lab ops', changeType: 'positive', icon: 'Award' }
]

export const DEMO_ADMIN_STATS: UIStatItem[] = [
  { label: 'Total Catalog Assets', value: 486, change: '94% operational', changeType: 'positive', icon: 'Server' },
  { label: 'Active Institutional Users', value: '2,840', change: '+320 this term', changeType: 'positive', icon: 'Users' },
  { label: 'Cross-Dept Bookings (Mo)', value: 642, change: '+24.5%', changeType: 'positive', icon: 'Repeat' },
  { label: 'CO2 & CapEx Avoidance', value: '$342,000', change: 'Carbon saved: 18.2 T', changeType: 'positive', icon: 'TrendingUp' }
]

export const DEMO_RECENT_ACTIVITIES = [
  {
    id: 'act-1',
    user: 'Maya Chen (Bioengineering)',
    action: 'checked out',
    target: 'Benchtop Scanning Electron Microscope (SEM)',
    time: '22 minutes ago',
    badge: 'Check-out Verified'
  },
  {
    id: 'act-2',
    user: 'Kiran Rao (Materials Lab)',
    action: 'approved reservation for',
    target: 'Industrial SLS 3D Printer',
    time: '1 hour ago',
    badge: 'Approved'
  },
  {
    id: 'act-3',
    user: 'Alex Rivera (Autonomous Systems)',
    action: 'completed return & inspection on',
    target: 'Survey-Grade RTK LiDAR Drone',
    time: '3 hours ago',
    badge: 'Inspected: Pristine'
  },
  {
    id: 'act-4',
    user: 'System Safety Monitor',
    action: 'flagged periodic maintenance on',
    target: 'Keysight Digital Phosphor Oscilloscope',
    time: 'Yesterday',
    badge: 'Scheduled Calibration'
  }
]
