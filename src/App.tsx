import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import MasterDetail from './pages/MasterDetail';
import Checkout from './pages/Checkout';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentFail from './pages/PaymentFail';
import PaymentRedirect from './pages/PaymentRedirect';
import OrderReport from './pages/OrderReport';
import CheongryongReport from './pages/CheongryongReport';
import SheepReport from './pages/SheepReport';
import TestOrderReport from './pages/TestOrderReport';
import TestMultiReport from './pages/TestMultiReport';
import ReportResult from './pages/ReportResult';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/master/:id" element={<MasterDetail />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/payment/redirect" element={<PaymentRedirect />} />
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/payment/fail" element={<PaymentFail />} />
      <Route path="/order/:token" element={<OrderReport />} />
      <Route path="/report/cheongryong/test" element={<CheongryongReport />} />
      <Route path="/report/sheep/test" element={<SheepReport />} />
      <Route path="/report/test" element={<TestOrderReport />} />
      
      {/* Dynamic Report Result */}
      <Route path="/report/:orderToken" element={<ReportResult />} />
      <Route path="/report/result" element={<ReportResult />} /> {/* Backward compatibility if needed, but likely broken without params */}

      {/* Test Routes for Specific Profiles */}
      <Route path="/report/test/minsu" element={<TestMultiReport />} />
      <Route path="/report/test/hyunju" element={<TestMultiReport />} />
      <Route path="/report/test/lari" element={<TestMultiReport />} />
      <Route path="/report/test/sungjae" element={<TestMultiReport />} />
      <Route path="/report/test/eojin" element={<TestMultiReport />} />
    </Routes>
  );
}

export default App;
