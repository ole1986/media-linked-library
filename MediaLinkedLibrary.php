<?php
/*
Plugin Name: Media Linked Library
Plugin URI:  https://github.com/ole1986/media-linked-library
Description: Support for adding media files to page/post content using the IDs instead of URLs
Version:     1.0.5
Author:      ole1986
Author URI:  https://profiles.wordpress.org/ole1986
License:     GPL2
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Domain Path: /languages
Text Domain: media-linked-library
*/

defined( 'ABSPATH' ) or die( 'No script kiddies please!' );

define( 'MLL_ROOT_URL', plugin_dir_url( __FILE__ ) );

$uploadDir = wp_upload_dir();
if(!defined('WP_UPLOAD_URI')) {
    define('WP_UPLOAD_URI', $uploadDir['baseurl']);
}

class MediaLinkedLibrary {

    public static $taxonomy = 'media_category';

    public function __construct(){
        // some global JS
        add_action('admin_head', array(&$this, 'script_header'));
        
        // TinyMCC Editor button and media plugin      
        add_filter( 'mce_buttons', array(&$this, 'register_tinymce_button') );
        add_filter( 'mce_external_plugins', array(&$this,'register_tinymce_plugin') );

        // register the shortcode [mediaref ...]
        add_shortcode('mediaref', array(&$this, 'media_reference_shortcode'));
        
        // ajax request to fetch media info
        add_action( 'wp_ajax_media_get', array(&$this,'media_get_callback') );
        add_action( 'wp_ajax_media_search', array(&$this,'media_search_callback') );
        add_action( 'wp_ajax_wp_handle_upload', array(&$this,'media_upload_callback') );
        add_action( 'wp_ajax_media_list_dirs', array(&$this,'media_list_dirs') );
        add_action( 'wp_ajax_media_create_folder', array(&$this,'media_create_folder') );
        // ajax request to fetch media categories (if available)
        add_action( 'wp_ajax_taxonomy_get', array(&$this, 'taxonomy_get_callback') );

        
        // Add Bulk operations in Media library (DropDown menu) to allow adding and removing categories
        add_action('load-upload.php',  array(&$this, 'media_bulkaction_submit'));
        add_action('admin_footer', array(&$this, 'media_bulkaction_category'));
        
    }
    
    /**
     * Used to receive the current directories from its root (relative to th upload dir)
     * @param {string} folder path as string
     * @return {array} list of directories and media ids located in th current folder 
     */
    private function getUploadFolders($root = '', $withMedia = false){
        global $uploadDir, $wpdb;
        $result = ['folders' => [], 'files' => []];

        $root = $this->pathSecurity($root);

        $list = glob($uploadDir['basedir'] . '/' . $root .'/*', GLOB_ONLYDIR);
        foreach ($list as $dir) {
            $result['folders'][] = '/'.basename($dir);
        }

        if($withMedia)
        {
            $quote = "^";
            if(!empty($root))
                $quote = preg_quote("{$root}/");
            $quote .= "[^\/]+$";
            $post_ids = $wpdb->get_col("SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_wp_attached_file' AND meta_value REGEXP '{$quote}'");
            
            $result['files'] = $post_ids;
            return $result;
        }
        return $result['folders'];
    }
    
    private function createUploadFolder($name, $root = ''){
        global $uploadDir;

        $name = $this->pathSecurity($name);
        $root = $this->pathSecurity($root);
        
        error_log("CreateFolder:" . $uploadDir['basedir']. "/ $root / $name");        

        return mkdir($uploadDir['basedir'] . '/' . $root . '/' . $name);
    }

    private function pathSecurity($path){
        return preg_replace(['/\.\.\//', '/\.\//', '/^[\/]+/'], '', $path);
    }

    /**
     * Some global JS variabled being used by mll-tinymce-plugin.js
     */
    public function script_header(){
        $pluginData = get_plugin_data( __FILE__ );
        echo "<script>
        var MLL_VERSION = '".$pluginData['Version']."';
        var MLL_UPLOAD_URL = '".WP_UPLOAD_URI."/';
        var MLL_PLUGIN_URL = '".MLL_ROOT_URL."';
        var MLL_IMAGE_NOTFOUND = 'mll-noimage.png';
        var MLL_FOLDER_OPEN = 'mll-folder-open.gif';
        var MLL_FOLDER_CLOSE = 'mll-folder-close.gif';
        var MLL_TOOLBAR_BUTTON = 'mll-toolbar-button.png';
        </script>";
    }
    
    /**
     * TinyMCE: Used to register the TinyMCE Editor button (with an image)
     */
    public function register_tinymce_button( $button_array ) {
        global $current_screen; //  WordPress contextual information about where we are.

        $type = $current_screen->post_type;

        if( is_admin() ) {
            array_push( $button_array, 'mll_button' );
        }

        return $button_array;
    }
    
    /**
     * TinyMCE: Register the new plugin 'mll_plugin' for TinyMCE
     */
    public function register_tinymce_plugin( $plugin_array ) {
        global $current_screen; //  WordPress contextual information about where we are.

        $type = $current_screen->post_type;
        
        if( is_admin() ) {
            $plugin_array['mll_plugin'] = MLL_ROOT_URL . 'js/mll-tinymce-plugin.js';
        }

        return $plugin_array;
    }
    
    /**
     * SHORTCODE: Register the shortcode '[mediaref id=<attachment Id> link=<media id> width=<width> height=<height>]'
     */
    public function media_reference_shortcode($attr){
        $imgmeta = wp_get_attachment_metadata(intval($attr['id']));
        // take the best matching image according to the defined size
        if($imgmeta === false) return '';
        
        $w = intval($attr['width']);
        $h = intval($attr['height']);
        
        $dir = dirname($imgmeta['file']);
        $best = ['height' => $imgmeta['height'], 'width' => $imgmeta['width'], 'file' => $imgmeta['file']];
        
        if(count($imgmeta['sizes']) > 0 && $w > 0 && $h > 0) {
             foreach($imgmeta['sizes'] as $ident => $prop) {
                if(($prop['width'] >= $w && $prop['height'] >= $h) && ($best['width'] > $prop['width'] && $best['height'] > $prop['height']))
                    $best = ['width' => $prop['width'], 'height' => $prop['height'], 'file' => $dir .'/' . $prop['file']];
            }
        }
        
        $result = '<p>';
        if(isset($attr['link'])) {
            $link = get_post_meta(intval($attr['link']), '_wp_attached_file',true);
            $newwnd = '';
            if(isset($attr['newwindow']) && $attr['newwindow'] == 'true')
                $newwnd = '_blank';
            $result.= sprintf('<a href="%s" target="%s">', WP_UPLOAD_URI . '/' .  $link, $newwnd);
        }
        
        $style = '';
        if($w > 0) $style.= "width:{$w}px;";
        if($h > 0) $style.= "height:{$h}px;";
        $result.= '<img src="'. WP_UPLOAD_URI .'/' . $best['file'].'" style="' . $style . '" />';
        
        if(isset($attr['link'])) $result.= '</a>';
        
        $result.= '</p>';
        
        return $result;
    }
    
    public function taxonomy_get_callback(){
        $terms = get_terms(['taxonomy' => self::$taxonomy, 'hide_empty' => 0]);
        
        if(!is_object($terms))
            echo json_encode($terms);
        
        wp_die();
    }
    public function media_get_callback(){
        $media = $this->getMedia($_POST['media_id'], true);
        echo json_encode($media);
        
        wp_die();
    }
    
    public function media_search_callback(){
        $mediaList = $this->searchMedia($_POST['filter'], $_POST['category'], [0,10], true, true);
        echo json_encode($mediaList);
        
        wp_die();
    }
    
    public function media_upload_callback(){
        global $uploadDir, $wpdb;

        if(!isset($_FILES['file'])) wp_die();

        $l = count($_FILES['file']['name']);
        if($l <= 0) wp_die();

        $result = [];

        $destination = $this->pathSecurity($_POST['path'] . '/');
        $filepathes = array_map(function($v) use($destination) {  return $destination . $v;  }, $_FILES['file']['name']);

        // check if file already exists
        $fn = implode("','", $filepathes);
        $existingAttachments = $wpdb->get_results( "SELECT meta_value, post_id FROM {$wpdb->postmeta} WHERE meta_key = '_wp_attached_file' AND meta_value IN('{$fn}')", OBJECT_K);

        for ($i=0; $i < $l; $i++) { 
            $filepath = $filepathes[$i];
            $filename = &$_FILES['file']['name'][$i];
            // skip file when its already in DB
            if(in_array($filepath, array_keys($existingAttachments))) {
                $result[] = intval($existingAttachments[$filepath]->post_id);
                continue;
            }

            $tmpname = &$_FILES['file']['tmp_name'][$i];
            $filetype = &$_FILES['file']['type'][$i];

            $movefile = move_uploaded_file( $tmpname, $uploadDir['basedir'] . '/' . $filepath);
            if($movefile) {
                $title = preg_replace('/\\.[^.\\s]{3,4}$/', '', $filename );
                $attachment_id = wp_insert_attachment( ['post_title' => $title, 'post_mime_type' => $filetype ], $filepath);
                // generate the thumbnail
                $metadata = wp_generate_attachment_metadata($attachment_id, $uploadDir['basedir'] . '/' . $filepath);
                wp_update_attachment_metadata($attachment_id, $metadata);

                $result[] = $attachment_id; 
            }
        }
        
        $existingAttachmentIDs = array_map(function($v){ return $v->post_id; }, $existingAttachments);

        $mediaList = $this->getMedia($result, true);
        // add property for existing already
        $mediaList = array_map(function($v) use($existingAttachmentIDs){  if(in_array($v->ID, $existingAttachmentIDs)) { $v->exists = true; } return $v; }, $mediaList);

        echo json_encode($mediaList);

        wp_die();
    }
    
    public function media_list_dirs(){
        $res = $this->getUploadFolders($_POST['dir'], true);
        echo json_encode($res);
        wp_die();
    }

    public function media_create_folder(){
        global $uploadDir;

        echo $this->createUploadFolder($_POST['name'], $_POST['dir']);

        wp_die();
    }
        
    private function searchMedia($filter, $category, $limit = [0,10], $withThumbnail = false, $withPath = false) {
        global $wpdb;
        
        $category = intval($category);
        
        $query = "SELECT ID FROM $wpdb->posts AS t1";
        if($category > 0)
            $query.= " LEFT JOIN $wpdb->term_relationships AS t2 ON (t2.object_id = t1.ID)";
        
        $query.= " WHERE t1.post_type = 'attachment' AND post_title LIKE %s";
        if($category > 0)
            $query.= " AND t2.term_taxonomy_id = %d";

        $query.=' LIMIT %d, %d';
        
        if($category > 0)
            $query = $wpdb->prepare($query, '%' . $filter . '%', $category, $limit[0], $limit[1]);
        else
            $query = $wpdb->prepare($query, '%' . $filter . '%', $limit[0], $limit[1]);
        
        $posts = $wpdb->get_results($query, OBJECT);
        
        $postIds = array_map(function($p) { return $p->ID; }, $posts);
        
        if(!empty($postIds))
            return $this->getMedia($postIds, true);
        return [];
    }
    
    private function getMedia($media_ids, $withMetadata = false) {
        if(is_array($media_ids))
        {
            $mediaList = get_posts(['post_type' => 'attachment','post__in' => $media_ids]);

            if($withMetadata) {
                foreach ($mediaList as &$media) {
                    $media->path = $media->_wp_attached_file;
                    $metadata = $media->_wp_attachment_metadata;

                    if(isset($metadata['sizes']['thumbnail']))
                        $media->thumbnail = dirname($media->path) . '/' . $metadata['sizes']['thumbnail']['file'];
                }
            }
            return $mediaList;
        } else {
            $media = get_post($media_ids);
            if($withMetadata) {
                $media->path = $media->_wp_attached_file;
                $metadata = $media->_wp_attachment_metadata;
                if(isset($metadata['sizes']['thumbnail']))
                    $media->thumbnail = dirname($media->path) . '/' . $metadata['sizes']['thumbnail']['file'];
            }
            return $media;
        }
    }   
    
    // MEDIA: BULK ACTION ALLOW CATEGORIES FROM MEDIA LIST - START
    public function media_bulkaction_category() {
        global $pagenow;
        if($pagenow != 'upload.php') return;
        
        $terms = get_terms(['taxonomy' => self::$taxonomy, 'hide_empty' => 0]);
        if(is_object($terms)) return;

        ?>
        <script type="text/javascript">
            jQuery(document).ready(function() {
            <?php foreach ($terms as $v) {
                echo "jQuery('<option>').val('cat:".$v->term_id."').text('Category: ".$v->name."').appendTo('.actions > select');";
            }
            
            echo "jQuery('<option>').val('uncat').text('UnCategories').appendTo('.actions > select');";
            ?>
            });
        </script>
        <?php
    }
    
    public function media_bulkaction_submit() {
        if (isset( $_REQUEST['detached']) ) return;

        // get the action
        $wp_list_table = _get_list_table('WP_Media_List_Table'); 
        $action = $wp_list_table->current_action();
        
        if(!preg_match('/^cat:([0-9]+)|uncat$/', $action, $regs)) return;
        
        // make sure ids are submitted.  depending on the resource type, this may be 'media' or 'ids'
        if(isset($_REQUEST['media'])) $post_ids = array_map('intval', $_REQUEST['media']);
        if(empty($post_ids)) return;
        
        // this is based on wp-admin/edit.php
        $sendback = remove_query_arg( array('exported', 'untrashed', 'deleted', 'ids'), wp_get_referer() );
        if ( ! $sendback ) $sendback = admin_url( "upload.php?post_type=$post_type" );

        $pagenum = $wp_list_table->get_pagenum();
        $sendback = add_query_arg( 'paged', $pagenum, $sendback );

        if(count($regs) > 1) {
            foreach($post_ids as $id) {
                wp_delete_object_term_relationships($id, 'media_category');
                wp_set_object_terms($id, [intval($regs[1])], 'media_category');
            }
        } else {
            foreach($post_ids as $id) {
                wp_delete_object_term_relationships($id, 'media_category');
            }
        }
        
        $sendback = remove_query_arg( array('action', 'action2', 'tags_input', 'post_author', 'comment_status', 'ping_status', '_status',  'post', 'bulk_edit', 'post_view'), $sendback );
        wp_redirect($sendback);
        exit();
    }
    // MEDIA: BULK ACTION ALLOW CATEGORIES FROM MEDIA LIST - END
}

new MediaLinkedLibrary();
?>