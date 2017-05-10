/* eslint-disable jsx-a11y/no-static-element-interactions,no-const-assign */
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import classNames from 'classnames';
import isRenderer from 'is-electron-renderer';
import { remote } from 'electron';
import withRedux from 'next-redux-wrapper';
import initStore from '../store';
import MediaModal from './MediaModal';
import getFileType from '../utils/logic/fileType';
import colors from '../constants/colors';
import castUtil from '../utils/cast';

let vlc;
if (isRenderer) {
  vlc = remote.require('./utils/vlc');
}

const Wrapper = styled.div`
  width: 100%;
  background-color: white;
  bottom: 0;
  flex:1;
  border-bottom: 1px solid #eee;
  overflow: hidden;
  display: flex;
  justify-content: center;
`;

const TileWrapper = styled.div`
  color: ${props => props.color};
  height: 3rem;
  width: 4rem;
  display: flex;
  align-items: center;
  align-content: space-around;
  font-size: 13px;
`;

const Table = styled.table`
  overflow: scroll;
  flex: 1;
  width: 100%;
`;

const Files = styled.div`
  flex: ${props => (props.showOnlyDetails ? '1' : '0.6')};
  padding: 10px;
  overflow: scroll;
`;

const Info = styled.div`
  flex: 0.4;
`;

const VlcIcon = styled.i`
  color: #FF6000;
  cursor: pointer;
  opacity: 0.8;
  &:hover{
    opacity: 1;
  }
`;

const ProgressContainer = styled.td`
  width: 190px;
  padding: 0 22px 6px 10px;
`;

@withRedux(initStore, ({ cast, details }) => ({
  cast,
  details
}))
export default class Description extends PureComponent {
  static propTypes = {
    dispatch: PropTypes.func,
    details: PropTypes.shape({
      name: PropTypes.string,
      torrentId: PropTypes.string,
      loading: PropTypes.bool,
      files: PropTypes.shape({
        name: PropTypes.string,
        type: PropTypes.string,
        size: PropTypes.string
      })
    }),
    customDetails: PropTypes.shape({
      name: PropTypes.string,
      torrentId: PropTypes.string,
      loading: PropTypes.bool,
      files: PropTypes.shape({
        name: PropTypes.string,
        type: PropTypes.string,
        size: PropTypes.string
      })
    }),
    cast: PropTypes.shape({
      selectedPlayer: PropTypes.any
    }).isRequired,
    showOnlyDetails: PropTypes.bool,
    showProgress: PropTypes.bool
  };

  static defaultProps = {
    showOnlyDetails: false,
    dispatch() {},
    details: {},
    fixed: false,
    showProgress: false
  };

  constructor(props) {
    super(props);

    this.state = {
      streaming: false,
      selectedIndex: null,
      isVlcPresent: true
    };
  }

  componentDidMount() {
    this.isVlcPresent();
  }

  startStream = (e) => {
    const selectedIndex = e.target.dataset.id;
    const d = this.props.customDetails || this.props.details;

    // if a cast player is selected then stream on the chromecast
    if (this.props.cast.selectedPlayer) {
      const file = d.files[selectedIndex];

      const fileDetails = {
        name: file.name,
        index: e.target.dataset.id,
        infoHash: d.torrentId,
        type: file.type
      };

      castUtil.play(fileDetails, (err) => {
        if (!err) {
          this.props.dispatch({
            type: 'SET_STREAMING_FILE',
            payload: fileDetails
          });
        } else {
          this.props.dispatch({
            type: 'REMOVE_STREAMING_FILE'
          });
        }
      });
      return;
    }

    // if no cast is connected stream in the app
    this.setState({
      streaming: true,
      selectedIndex
    });
  };

  closeModal = () => {
    const d = this.props.customDetails || this.props.details;

    this.setState({ streaming: false });
    fetch(`/api/delete/${d.torrentId}`);
  };

  getFileIcon = (mime) => {
    let icon;

    switch (getFileType(mime)) {
      case 'audio':
        icon = 'mdi-music-note';
        break;
      case 'video':
        icon = 'mdi-movie';
        break;
      case 'application':
        icon = 'mdi-application';
        break;
      case 'zip':
        icon = 'mdi-zip-box';
        break;
      case 'image':
        icon = 'mdi-file-image';
        break;
      default:
        icon = 'mdi-file-document';
    }
    return (
      <TileWrapper color={colors.primary}>
        <i style={{ fontSize: '18px' }} className={`mdi ${icon} centered`} />
      </TileWrapper>
    );
  };

  isVlcPresent = () => {
    vlc.isVlcPresent(isVlcPresent =>
      this.setState({
        isVlcPresent
      })
    );
  };

  streamOnVlc = (e) => {
    const d = this.props.customDetails || this.props.details;
    const selectedIndex = e.target.dataset.id;
    const infoHash = d.torrentId;
    const file = d.files[selectedIndex];
    vlc.kill();
    vlc.playOnVlc(
      `http://127.0.0.1:${window.location.port}/api/download/${infoHash}/${+selectedIndex}/${file.name}`,
      file.name
    );
  };

  getFiles = () => {
    const { details, showOnlyDetails, showProgress, customDetails } = this.props;

    // eslint-disable-next-line no-const-assign
    const d = customDetails || details;

    const x =
      d &&
      d.files &&
      d.files.map((file, i) => {
        const fileType = getFileType(file.type);
        const streamIcon = classNames('mdi tooltip tooltip-left fs-18', {
          'mdi-play-circle-outline': fileType === 'video',
          'mdi-eye': fileType === 'image'
        });

        return (
          <tr>
            <td style={{ width: '50px' }}>{this.getFileIcon(file.type)}</td>
            <td style={{ maxWidth: '270px' }} className="text-ellipsis">{file.name}</td>
            {showProgress &&
              <ProgressContainer>
                <progress className="progress" max="100" value={Math.min(file.progress, 100)} />
              </ProgressContainer>}
            <td>{file.size}</td>
            {this.state.isVlcPresent &&
              <td>
                {getFileType(file.type) === 'video' &&
                  <VlcIcon
                    data-id={i}
                    data-tooltip="Play on VLC"
                    onClick={this.streamOnVlc}
                    className="mdi mdi-vlc fs-18 tooltip tooltip-left"
                  />}
              </td>}
            <td>
              {Description.isSupported(file.type) &&
                <button className="btn btn-link" onClick={this.startStream}>
                  <i
                    className={streamIcon}
                    data-tooltip={fileType === 'video' ? 'Play Video' : 'View Image'}
                    data-id={i}
                  />
                </button>}
            </td>
          </tr>
        );
      });

    return (
      <Files showOnlyDetails={showOnlyDetails}>
        <Table>
          <tbody>{x}</tbody>
        </Table>
      </Files>
    );
  };

  static isSupported(mime) {
    return (
      document.createElement('video').canPlayType(mime) ||
      mime === 'video/x-matroska' ||
      getFileType(mime) === 'image'
    );
  }

  render() {
    const { details, showOnlyDetails, customDetails } = this.props;

    const d = customDetails || details;

    if (d.loading || !d.name) {
      return (
        <Wrapper>
          <div className="loading" />
        </Wrapper>
      );
    }

    return (
      <Wrapper>
        {!showOnlyDetails && <Info />}
        {this.getFiles()}
        <MediaModal
          infoHash={d.torrentId}
          fileIndex={this.state.selectedIndex}
          showModal={this.state.streaming}
          file={d.files[this.state.selectedIndex]}
          onCloseClick={this.closeModal}
        />
      </Wrapper>
    );
  }
}
