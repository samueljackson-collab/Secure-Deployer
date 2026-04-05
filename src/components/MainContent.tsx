import { useAppContext } from '../contexts/AppContext';
import RemoteDesktop from './RemoteDesktop';

const MainContent = () => {
    const { state } = useAppContext();

    const renderActiveTab = () => {
        switch (state.ui.activeTab) {
            case 'runner':
                return <div>Runner Tab</div>;
            case 'remote':
                return <RemoteDesktop />;
            default:
                return <div>Dashboard</div>;
        }
    };

    return <div className="flex-1 p-4">{renderActiveTab()}</div>;
};

export default MainContent;
