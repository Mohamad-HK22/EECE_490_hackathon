import React, { useState } from 'react';
import Layout from './components/Layout';
import Executive from './pages/Executive';
import WhatChanged from './pages/WhatChanged';
import Actions from './pages/Actions';
import Simulator from './pages/Simulator';
import GroupDNA from './pages/GroupDNA';
import Reports from './pages/Reports';
import './App.css';

const PAGES = {
  executive:  { component: Executive,   label: 'Executive Summary' },
  changed:    { component: WhatChanged, label: 'What Changed'      },
  actions:    { component: Actions,     label: 'Action Generator'  },
  simulator:  { component: Simulator,   label: 'Profit Simulator'  },
  dna:        { component: GroupDNA,    label: 'Group DNA'         },
  reports:    { component: Reports,     label: 'Reports'           },
};

export default function App() {
  const [page,   setPage]   = useState('executive');
  const [branch, setBranch] = useState('all');

  const PageComponent = PAGES[page]?.component || Executive;

  return (
    <Layout
      currentPage={page}
      onNavigate={setPage}
      branch={branch}
      onBranchChange={setBranch}
    >
      <PageComponent branch={branch} />
    </Layout>
  );
}
